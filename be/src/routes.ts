import { Router } from "express";
import { z } from "zod";
import { route, TAGS } from "./lib/route";
import * as s from "./schemas";
import * as accounts from "./services/accounts";
import * as ai from "./services/ai";
import * as dashboard from "./services/dashboard";
import * as homework from "./services/homework";
import * as parents from "./services/parents";
import * as practice from "./services/practice";
import * as rewards from "./services/rewards";

export function apiRouter(): Router {
  const r = Router();

  // ---------------------------------------------------------------- auth
  route(r, {
    method: "post", path: "/auth/teacher/login", tag: [TAGS.guru, TAGS.anak], summary: "Login guru (aplikasi guru / mode kelas di laptop)",
    body: s.loginBody,
    handler: ({ body }) => accounts.teacherLogin(body.email, body.password),
  });
  route(r, {
    method: "post", path: "/auth/parent/login", tag: TAGS.ortu, summary: "Login orang tua (setelah aktivasi lewat link undangan)",
    body: s.loginBody,
    handler: ({ body }) => accounts.parentLogin(body.email, body.password),
  });
  route(r, {
    method: "post", path: "/auth/student/login", tag: TAGS.anak, auth: ["teacher", "device"],
    summary: "Login anak di perangkat kelas: id anak + PIN 3 gambar (nomor 1-9). Salah 5x = terkunci. Token guru atau token perangkat kelas",
    body: s.studentLoginBody,
    handler: async ({ user, body }) =>
      accounts.studentLogin(
        user.role === "device"
          ? await accounts.classroomStudent(user.id, body.studentId)
          : await accounts.ownedStudent(user.id, body.studentId),
        body.picturePassword,
      ),
  });

  // ------------------------------------------------------ web sekolah (perangkat kelas)
  route(r, {
    method: "get", path: "/classroom/students", tag: TAGS.anak, auth: ["teacher", "device"],
    summary: "Daftar anak di kelas (layar pilih profil). Token perangkat kelas selalu melihat kelasnya sendiri",
    query: s.classroomQuery,
    handler: ({ user, query }) =>
      user.role === "device" ? accounts.studentsOfClassroom(user.id) : accounts.listStudents(user.id, query.classroomId),
  });

  // --------------------------------------------------------------- siswa
  route(r, {
    method: "get", path: "/me/student", tag: TAGS.anak, auth: "student", summary: "Profil anak, poin, streak",
    handler: ({ user }) => practice.studentProfile(user.id),
  });
  route(r, {
    method: "put", path: "/me/calibration", tag: TAGS.anak, auth: "student",
    summary: "Simpan model bibir personal dari komponen Mata (ModelBibir); diteruskan ke layanan AI",
    body: s.lipModelBody,
    handler: ({ user, body }) => practice.saveCalibration(user.id, body),
  });
  route(r, {
    method: "get", path: "/me/calibration", tag: TAGS.anak, auth: "student",
    summary: "Ambil model bibir personal anak (null kalau belum dilatih), untuk dimuat Mata saat login",
    handler: ({ user }) => practice.getCalibration(user.id),
  });
  route(r, {
    method: "get", path: "/levels", tag: TAGS.anak, auth: "student",
    summary: "Peta petualangan: 6 level, tiap item berisi bintang terbaik + tutorialUrl (video). Level terbuka kalau level sebelumnya >= 1 bintang",
    handler: ({ user }) => practice.adventureMap(user.id),
  });
  route(r, {
    method: "post", path: "/attempts", tag: TAGS.anak, auth: "student", status: 201,
    summary: "Kirim hasil satu percobaan dari Mata (+ itemId). Mengembalikan bintang, poin, streak, status PR, dan item berikutnya dari AI",
    body: s.attemptBody,
    handler: ({ user, body }) => practice.submitAttempt(user, body),
  });
  route(r, {
    method: "get", path: "/rewards", tag: TAGS.anak, auth: "student", summary: "Toko hadiah: poin, katalog, riwayat penukaran",
    handler: ({ user }) => rewards.shopForStudent(user.id),
  });
  route(r, {
    method: "post", path: "/rewards/:id/redeem", tag: TAGS.anak, auth: "student", status: 201,
    summary: "Tukar poin dengan hadiah",
    handler: ({ user, params }) => rewards.redeem(user.id, params.id),
  });

  // ---------------------------------------------------------------- guru
  route(r, {
    method: "get", path: "/classrooms", tag: TAGS.guru, auth: "teacher", summary: "Kelas saya (layar Kelas Saya)",
    handler: ({ user }) => accounts.listClassrooms(user.id),
  });
  route(r, {
    method: "post", path: "/classrooms", tag: TAGS.guru, auth: "teacher", status: 201, summary: "Tambah kelas",
    body: s.createClassroomBody,
    handler: ({ user, body }) => accounts.createClassroom(user.id, body.name),
  });
  route(r, {
    method: "post", path: "/students", tag: TAGS.guru, auth: "teacher", status: 201,
    summary: "Guru membuat akun anak (+PIN 3 gambar). Jawaban memuat `invite` = link orang tua siap disalin",
    body: s.createStudentBody,
    handler: ({ user, body }) => parents.addStudent(user.id, body),
  });
  route(r, {
    method: "patch", path: "/students/:id", tag: TAGS.guru, auth: "teacher",
    summary: "Ubah data anak: foto (`photoUrl`: link atau data URL base64, maks ±700 KB; null = hapus) dan/atau nama panggilan",
    body: s.updateStudentBody,
    handler: ({ user, params, body }) => accounts.updateStudent(user.id, params.id, body),
  });
  route(r, {
    method: "put", path: "/students/:id/picture-password", tag: TAGS.guru, auth: "teacher",
    summary: "Ganti PIN gambar anak (lupa PIN); sekaligus membuka kunci",
    body: s.resetPicturePasswordBody,
    handler: ({ user, params, body }) => accounts.resetPicturePassword(user.id, params.id, body.picturePassword),
  });
  route(r, {
    method: "put", path: "/students/:id/level", tag: TAGS.guru, auth: "teacher",
    summary: "Guru menetapkan level tertinggi yang boleh dibuka anak (1-6); null = kembali ke aturan bintang. Level di atasnya terkunci di akun anak",
    body: s.levelCapBody,
    handler: ({ user, params, body }) => accounts.setMaxLevel(user.id, params.id, body.maxLevel),
  });
  route(r, {
    method: "post", path: "/students/:id/unlock", tag: TAGS.guru, auth: "teacher", summary: "Buka kunci akun anak",
    handler: ({ user, params }) => accounts.unlockStudent(user.id, params.id),
  });
  route(r, {
    method: "post", path: "/parents/invites", tag: TAGS.guru, auth: "teacher", status: 201,
    summary: "Undang orang tua: nama + anak (dropdown). Mengembalikan link undangan + teks/link WhatsApp",
    body: s.createInviteBody,
    handler: ({ user, body }) => parents.createInvite(user.id, body),
  });
  route(r, {
    method: "get", path: "/parents", tag: TAGS.guru, auth: "teacher", summary: "Daftar orang tua + status (menunggu/aktif)",
    query: s.classroomQuery,
    handler: ({ user, query }) => parents.listParents(user.id, query.classroomId),
  });
  route(r, {
    method: "post", path: "/parents/:id/invites", tag: TAGS.guru, auth: "teacher", status: 201,
    summary: "Buat ulang link undangan (link lama hangus)",
    handler: ({ user, params }) => parents.regenerateInvite(user.id, params.id),
  });
  route(r, {
    method: "get", path: "/dashboard/class", tag: TAGS.guru, auth: "teacher",
    summary: "Monitoring sekelas: total + ringkasan per anak",
    query: s.classroomQuery,
    handler: ({ user, query }) => dashboard.classOverview(user.id, query.classroomId),
  });
  route(r, {
    method: "get", path: "/dashboard/class/sounds", tag: TAGS.guru, auth: "teacher",
    summary: "Tabel kelas: tiap anak x bunyi a,i,u,e,o,... (status + centang `cleared`) dan `canDo`",
    query: s.classroomQuery,
    handler: ({ user, query }) => dashboard.classSoundTable(user.id, query.classroomId),
  });
  route(r, {
    method: "get", path: "/dashboard/students/:id", tag: TAGS.guru, auth: "teacher",
    summary: "Progres satu anak: level, riwayat, streak, PR",
    handler: ({ user, params }) => dashboard.studentDetail(user.id, params.id),
  });
  route(r, {
    method: "get", path: "/dashboard/students/:id/chart", tag: TAGS.guru, auth: "teacher",
    summary: "Grafik belajar per hari, siap digambar: labels + series (latihan, benar, akurasi, poin); hari kosong = 0",
    query: s.chartQuery,
    handler: async ({ user, params, query }) => {
      await accounts.ownedStudent(user.id, params.id);
      return dashboard.learningChart(params.id, query.days);
    },
  });
  route(r, {
    method: "get", path: "/ai/class/insight", tag: TAGS.guru, auth: "teacher", summary: "Ringkasan AI untuk sekelas",
    query: s.classroomQuery,
    handler: ({ user, query }) => ai.classInsight(user.id, query.classroomId),
  });
  route(r, {
    method: "get", path: "/ai/class/suggested-homework", tag: TAGS.guru, auth: "teacher",
    summary: "Usulan PR AI untuk semua anak di kelas (guru setujui lewat POST /homework/batch)",
    query: s.classroomQuery,
    handler: ({ user, query }) => ai.classSuggestedHomework(user.id, query.classroomId),
  });
  route(r, {
    method: "get", path: "/ai/students/:id/insight", tag: TAGS.guru, auth: "teacher",
    summary: "Ringkasan AI satu anak: level + kendala",
    handler: ({ user, params }) => ai.studentInsight(user.id, params.id),
  });
  route(r, {
    method: "get", path: "/ai/students/:id/suggested-homework", tag: TAGS.guru, auth: "teacher",
    summary: "Usulan PR dari AI (guru boleh ubah sebelum kirim)",
    handler: ({ user, params }) => ai.suggestHomework(user.id, params.id),
  });
  route(r, {
    method: "get", path: "/ai/students/:id/history", tag: TAGS.guru, auth: "teacher",
    summary: "Riwayat latihan harian dan kemajuan per bunyi (untuk grafik)",
    handler: ({ user, params }) => ai.studentHistory(user.id, params.id),
  });
  route(r, {
    method: "post", path: "/ai/students/:id/ask", tag: TAGS.guru, auth: "teacher",
    summary: "Tanya AI tentang progres satu anak (jawaban dari data latihan)",
    body: s.askBody,
    handler: async ({ user, params, body }) =>
      ai.askAboutChild(await accounts.ownedStudent(user.id, params.id), body.question, "guru"),
  });
  route(r, {
    method: "post", path: "/homework", tag: TAGS.guru, auth: "teacher", status: 201,
    summary: "Kirim PR ke anak (dikerjakan bersama orang tua)",
    body: s.homeworkBody,
    handler: ({ user, body }) => homework.createHomework(user.id, body),
  });
  route(r, {
    method: "post", path: "/homework/batch", tag: TAGS.guru, auth: "teacher", status: 201,
    summary: "Setuju Semua: kirim PR ke banyak anak sekaligus (semua berhasil atau tidak sama sekali)",
    body: s.homeworkBatchBody,
    handler: ({ user, body }) => homework.createHomeworkBatch(user.id, body),
  });
  route(r, {
    method: "get", path: "/homework/submissions", tag: TAGS.guru, auth: "teacher",
    summary: "PR di kelas beserta hasil pengerjaannya",
    query: z.object({ studentId: z.uuid().optional(), status: s.homeworkStatus.optional(), classroomId: z.uuid().optional() }),
    handler: ({ user, query }) => homework.submissions(user.id, query),
  });
  route(r, {
    method: "get", path: "/teacher/rewards", tag: TAGS.guru, auth: "teacher", summary: "Katalog hadiah guru",
    handler: ({ user }) => rewards.teacherRewards(user.id),
  });
  route(r, {
    method: "post", path: "/teacher/rewards", tag: TAGS.guru, auth: "teacher", status: 201, summary: "Tambah hadiah",
    body: s.createRewardBody,
    handler: ({ user, body }) => rewards.createReward(user.id, body),
  });
  route(r, {
    method: "get", path: "/teacher/redemptions", tag: TAGS.guru, auth: "teacher", summary: "Penukaran hadiah di kelas",
    query: z.object({ status: z.enum(["requested", "given"]).optional() }),
    handler: ({ user, query }) => rewards.classRedemptions(user.id, query.status),
  });
  route(r, {
    method: "post", path: "/teacher/redemptions/:id/give", tag: TAGS.guru, auth: "teacher",
    summary: "Tandai hadiah sudah diserahkan",
    handler: ({ user, params }) => rewards.markGiven(user.id, params.id),
  });

  // ------------------------------------------------------------ undangan
  route(r, {
    method: "get", path: "/invites/:token", tag: TAGS.ortu, summary: "Info link undangan: nama orang tua + anak",
    handler: ({ params }) => parents.inviteInfo(params.token),
  });
  route(r, {
    method: "post", path: "/invites/:token/accept", tag: TAGS.ortu,
    summary: "Orang tua mengisi Gmail + kata sandi; akun aktif dan langsung masuk",
    body: s.acceptInviteBody,
    handler: ({ params, body }) => parents.acceptInvite(params.token, body),
  });

  // ------------------------------------------------------------ orang tua
  route(r, {
    method: "get", path: "/parent/children", tag: TAGS.ortu, auth: "parent", summary: "Anak-anak yang tertaut",
    handler: ({ user }) => parents.children(user.id),
  });
  route(r, {
    method: "get", path: "/parent/children/:id/homework", tag: TAGS.ortu, auth: "parent", summary: "PR anak; tiap item punya tutorialUrl (video bentuk mulut) atau null",
    query: z.object({ status: s.homeworkStatus.optional() }),
    handler: async ({ user, params, query }) => {
      await parents.linkedChild(user.id, params.id);
      return homework.homeworkForStudent(params.id, query.status);
    },
  });
  route(r, {
    method: "post", path: "/parent/children/:id/practice-token", tag: TAGS.ortu, auth: "parent",
    summary: "Token latihan di rumah (PR / latihan bebas) tanpa password gambar anak",
    handler: async ({ user, params }) => parents.homePracticeToken(await parents.linkedChild(user.id, params.id)),
  });
  route(r, {
    method: "get", path: "/parent/children/:id/streak", tag: TAGS.ortu, auth: "parent",
    summary: "Streak anak + kalender 7 hari",
    handler: async ({ user, params }) => {
      await parents.linkedChild(user.id, params.id);
      return practice.streakOf(params.id);
    },
  });
  route(r, {
    method: "get", path: "/parent/children/:id/chart", tag: TAGS.ortu, auth: "parent",
    summary: "Grafik belajar anak per hari, siap digambar (sama dengan grafik di aplikasi guru)",
    query: s.chartQuery,
    handler: async ({ user, params, query }) => {
      await parents.linkedChild(user.id, params.id);
      return dashboard.learningChart(params.id, query.days);
    },
  });
  route(r, {
    method: "get", path: "/parent/children/:id/progress", tag: TAGS.ortu, auth: "parent",
    summary: "Peta petualangan anak: bintang terbaik per item (tanda selesai) + tutorialUrl",
    handler: async ({ user, params }) => {
      await parents.linkedChild(user.id, params.id);
      return practice.adventureMap(params.id);
    },
  });
  route(r, {
    method: "get", path: "/parent/children/:id/weekly-report", tag: TAGS.ortu, auth: "parent",
    summary: "Laporan mingguan untuk orang tua (ditulis AI): yang sudah bisa, sedang dilatih, cara membantu",
    handler: async ({ user, params }) => ai.weeklyReport(await parents.linkedChild(user.id, params.id)),
  });
  route(r, {
    method: "post", path: "/parent/children/:id/ask", tag: TAGS.ortu, auth: "parent",
    summary: "Tanya AI tentang progres anak (jawaban dari data latihan)",
    body: s.askBody,
    handler: async ({ user, params, body }) =>
      ai.askAboutChild(await parents.linkedChild(user.id, params.id), body.question, "orang_tua"),
  });

  return r;
}
