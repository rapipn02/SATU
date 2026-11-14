/** Parent invites (teacher picks parent name + child), activation by link, and parent-side reads. */

import { config } from "../config";
import { db, type Queryable } from "../db";
import { conflict, notFound } from "../lib/errors";
import { hashPassword, newInviteToken, sha256, signToken } from "../lib/security";
import { classroomOf, insertStudent, type NewStudent, prepareStudent } from "./accounts";
import { startMlSession } from "./ml-state";

function inviteLinks(token: string, parentName: string, children: string[], whatsapp: string | null = null) {
  const base = config.INVITE_URL ?? `${config.WEB_URL.replace(/\/$/, "")}/undangan`;
  const inviteUrl = `${base.replace(/\/$/, "")}/${token}`;
  const whatsappText =
    `Halo ${parentName}, silakan aktifkan akun SATU untuk mendampingi ${children.join(" dan ")} ` +
    `berlatih bicara di rumah: ${inviteUrl}`;
  return {
    inviteToken: token, // the parent mobile app passes this to GET/POST /invites/:token
    inviteUrl,
    whatsappText,
    // Opens a chat straight to the parent's number when the teacher saved it on the child.
    whatsappUrl: `https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(whatsappText)}`,
  };
}

async function issueInvite(q: Queryable, parentId: string) {
  const { token, hash } = newInviteToken();
  const { rows } = await q.query<{ expiresAt: string }>(
    `insert into parent_invites (token_hash, parent_id) values ($1, $2) returning expires_at as "expiresAt"`,
    [hash, parentId],
  );
  return { token, expiresAt: rows[0].expiresAt };
}

/** Teacher adds a child: account + parent placeholder + one-time invite link, in one transaction. */
export async function addStudent(teacherId: string, input: NewStudent & { parentName?: string }) {
  const { parentName, ...studentInput } = input;
  const prepared = await prepareStudent(teacherId, studentInput);
  return db().tx(async (q) => {
    const student = await insertStudent(q, studentInput, prepared);
    const name = parentName ?? `Orang tua ${student.nickname}`;
    const { rows } = await q.query<{ id: string }>("insert into parents (name, invited_by) values ($1, $2) returning id", [
      name,
      teacherId,
    ]);
    await q.query("insert into parent_students (parent_id, student_id) values ($1, $2)", [rows[0].id, student.id]);
    const invite = await issueInvite(q, rows[0].id);
    const { inviteToken, inviteUrl } = inviteLinks(invite.token, name, [student.nickname]);
    return { ...student, parentId: rows[0].id, invite: { inviteToken, inviteUrl, expiresAt: invite.expiresAt } };
  });
}

export async function createInvite(teacherId: string, input: { parentName: string; studentIds: string[] }) {
  const studentIds = [...new Set(input.studentIds)];
  const { rows: students } = await db().query<{ id: string; nickname: string; parentWhatsapp: string | null }>(
    `select s.id, s.nickname, s.parent_whatsapp as "parentWhatsapp"
       from students s join classrooms c on c.id = s.classroom_id
      where c.teacher_id = $1 and s.id = any($2::uuid[]) order by s.nickname`,
    [teacherId, studentIds],
  );
  if (students.length !== studentIds.length) throw notFound("Ada siswa yang tidak ditemukan di kelas ini");

  return db().tx(async (q) => {
    const { rows } = await q.query<{ id: string }>(
      "insert into parents (name, invited_by) values ($1, $2) returning id",
      [input.parentName, teacherId],
    );
    const parentId = rows[0].id;
    for (const student of students) {
      await q.query("insert into parent_students (parent_id, student_id) values ($1, $2)", [parentId, student.id]);
    }
    const invite = await issueInvite(q, parentId);
    return {
      parent: {
        id: parentId,
        name: input.parentName,
        status: "menunggu" as const,
        children: students.map(({ id, nickname }) => ({ id, nickname })),
      },
      expiresAt: invite.expiresAt,
      ...inviteLinks(
        invite.token,
        input.parentName,
        students.map((s) => s.nickname),
        students.find((s) => s.parentWhatsapp)?.parentWhatsapp ?? null,
      ),
    };
  });
}

/** Parents linked to at least one child in the teacher's classroom. */
export async function listParents(teacherId: string, classroomId?: string) {
  const classroom = await classroomOf(teacherId, classroomId);
  const { rows } = await db().query(
    `select p.id, p.name, p.email,
            case when p.activated_at is null then 'menunggu' else 'aktif' end as status,
            p.activated_at as "activatedAt",
            json_agg(json_build_object('id', s.id, 'nickname', s.nickname) order by s.nickname) as children
       from parents p
       join parent_students ps on ps.parent_id = p.id
       join students s on s.id = ps.student_id
      where s.classroom_id = $1
      group by p.id
      order by p.name`,
    [classroom.id],
  );
  return rows;
}

/** New link for a parent who has not activated yet; any earlier unused link stops working. */
export async function regenerateInvite(teacherId: string, parentId: string) {
  const { rows } = await db().query<{ name: string; activated_at: string | null; children: string[] }>(
    `select p.name, p.activated_at, array_agg(s.nickname order by s.nickname) as children
       from parents p
       join parent_students ps on ps.parent_id = p.id
       join students s on s.id = ps.student_id
       join classrooms c on c.id = s.classroom_id
      where p.id = $1 and c.teacher_id = $2
      group by p.id`,
    [parentId, teacherId],
  );
  const parent = rows[0];
  if (!parent) throw notFound("Orang tua tidak ditemukan");
  if (parent.activated_at) throw conflict("Akun orang tua ini sudah aktif");

  return db().tx(async (q) => {
    await q.query("update parent_invites set expires_at = now() where parent_id = $1 and used_at is null", [parentId]);
    const invite = await issueInvite(q, parentId);
    return { expiresAt: invite.expiresAt, ...inviteLinks(invite.token, parent.name, parent.children) };
  });
}

async function validInvite(q: Queryable, token: string, lock = false) {
  const { rows } = await q.query<{ parentId: string; parentName: string }>(
    `select i.parent_id as "parentId", p.name as "parentName"
       from parent_invites i join parents p on p.id = i.parent_id
      where i.token_hash = $1 and i.used_at is null and i.expires_at > now() and p.activated_at is null
      ${lock ? "for update of i" : ""}`,
    [sha256(token)],
  );
  if (!rows[0]) throw notFound("Link undangan tidak berlaku. Minta guru mengirim link baru.");
  return rows[0];
}

export async function inviteInfo(token: string) {
  const invite = await validInvite(db(), token);
  const { rows } = await db().query<{ nickname: string }>(
    `select s.nickname from parent_students ps join students s on s.id = ps.student_id
      where ps.parent_id = $1 order by s.nickname`,
    [invite.parentId],
  );
  return { parentName: invite.parentName, children: rows.map((r) => r.nickname) };
}

export async function acceptInvite(token: string, input: { email: string; password: string }) {
  const passwordHash = await hashPassword(input.password);
  return db().tx(async (q) => {
    const invite = await validInvite(q, token, true);
    const taken = await q.query("select 1 from parents where email = $1", [input.email]);
    if (taken.rows.length) throw conflict("Email ini sudah dipakai akun lain");

    await q.query(
      "update parents set email = $2, password_hash = $3, activated_at = now() where id = $1",
      [invite.parentId, input.email, passwordHash],
    );
    await q.query("update parent_invites set used_at = now() where token_hash = $1", [sha256(token)]);
    return {
      token: signToken({ id: invite.parentId, role: "parent" }),
      role: "parent" as const,
      parent: { id: invite.parentId, name: invite.parentName, email: input.email },
    };
  });
}

export async function children(parentId: string) {
  const { rows } = await db().query(
    `select s.id, s.nickname, s.photo_url as "photoUrl", s.total_points as "totalPoints",
            c.name as "classroomName"
       from parent_students ps
       join students s on s.id = ps.student_id
       join classrooms c on c.id = s.classroom_id
      where ps.parent_id = $1
      order by s.nickname`,
    [parentId],
  );
  return rows;
}

/** The child, if linked to this parent; 404 otherwise. */
export async function linkedChild(parentId: string, studentId: string) {
  const { rows } = await db().query<{ id: string; nickname: string; photoUrl: string | null }>(
    `select s.id, s.nickname, s.photo_url as "photoUrl"
       from parent_students ps join students s on s.id = ps.student_id
      where ps.parent_id = $1 and s.id = $2`,
    [parentId, studentId],
  );
  if (!rows[0]) throw notFound("Anak tidak ditemukan");
  return rows[0];
}

/** A student token tagged "home", so the child can practise on the parent's phone without the picture password. */
export function homePracticeToken(child: { id: string; nickname: string; photoUrl: string | null }) {
  startMlSession(child.id);
  return {
    token: signToken({ id: child.id, role: "student", src: "home" }),
    role: "student" as const,
    student: child,
  };
}
