/**
 * PDF report for the teacher: one page per child with progress per map level (Huruf Vokal, Huruf Konsonan,
 * Suku Kata, Kata 2 Suku Kata), speech progress per day, streak and the AI note.
 */

import PDFDocument from "pdfkit";
import { db } from "../db";
import { ITEM_PETA } from "../lib/peta";
import { classroomOf } from "./accounts";
import { studentInsight } from "./ai";
import { learningChart } from "./dashboard";
import { adventureMap, streakOf } from "./practice";

/** Map pages on the child's web, 5 exercises each (same order as ITEM_PETA). */
const LEVELS = ["Huruf Vokal", "Huruf Konsonan", "Suku Kata", "Kata 2 Suku Kata"].map((name, i) => ({
  name,
  items: ITEM_PETA.slice(i * 5, i * 5 + 5),
}));

const ORANGE = "#E86826";
const GREY = "#666666";
const LIGHT = "#F3E3D3";

type Child = { id: string; nickname: string; totalPoints: number };

async function childData(teacherId: string, child: Child, days: number) {
  const [map, chart, streak, ai] = await Promise.all([
    adventureMap(child.id),
    learningChart(child.id, days),
    streakOf(child.id),
    studentInsight(teacherId, child.id).catch(() => null), // AI down: the PDF still prints without the note
  ]);
  const items = new Map(map.flatMap((l) => l.items.map((i) => [i.id, i] as const)));
  const levels = LEVELS.map((l) => {
    const list = l.items.map((id) => ({ text: items.get(id)?.text ?? id.slice(3), stars: items.get(id)?.bestStars ?? 0 }));
    const done = list.filter((i) => i.stars > 0).length;
    return { name: l.name, list, done, pct: Math.round((done * 100) / list.length) };
  });
  return { child, levels, chart, streak, ai };
}

type Data = Awaited<ReturnType<typeof childData>>;

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor(ORANGE).text(text).moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("black");
}

function bar(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fraction: number) {
  doc.roundedRect(x, y, w, h, h / 2).fill(LIGHT);
  if (fraction > 0) doc.roundedRect(x, y, Math.max(h, w * fraction), h, h / 2).fill(ORANGE);
  doc.fillColor("black");
}

function childPage(doc: PDFKit.PDFDocument, d: Data, classroom: string, printed: string) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(18).fillColor(ORANGE).text(`Laporan Perkembangan Bicara: ${d.child.nickname}`);
  doc.font("Helvetica").fontSize(10).fillColor(GREY).text(`${classroom} · dicetak ${printed} · ${d.chart.days} hari terakhir`);
  doc.fillColor("black");

  heading(doc, "Ringkasan");
  const s = d.chart.summary;
  doc.text(
    `Poin: ${d.child.totalPoints}    Streak: ${d.streak.current} hari (terpanjang ${d.streak.longest})    ` +
      `Hari latihan: ${s.practiceDays}/${d.chart.days}`,
  );
  doc.text(`Latihan: ${s.attempts}    Benar: ${s.correct}    Akurasi rata-rata: ${s.accuracy}%`);

  heading(doc, "Penguasaan per Level");
  for (const l of d.levels) {
    const y = doc.y;
    doc.font("Helvetica-Bold").text(l.name, left, y, { width: 110 });
    bar(doc, left + 110, y + 2, 110, 8, l.done / l.list.length);
    doc.font("Helvetica").text(`${l.done}/${l.list.length} (${l.pct}%)`, left + 228, y, { width: 62 });
    doc.fillColor(GREY).text(
      l.list.map((i) => `${i.text}${i.stars ? ` ${i.stars}*` : " -"}`).join("   "),
      left + 292, y, { width: width - 292 },
    );
    doc.fillColor("black").x = left;
    doc.moveDown(0.5);
  }
  doc.fontSize(8).fillColor(GREY).text("Angka* = bintang terbaik (1-3); - = belum bisa. Satu latihan dianggap bisa setelah dapat minimal 1 bintang.", left);
  doc.fontSize(10).fillColor("black");

  heading(doc, "Perkembangan Bicara per Hari");
  const cols = [left, left + 110, left + 190, left + 260, left + 340];
  let y = doc.y;
  doc.font("Helvetica-Bold");
  ["Hari", "Latihan", "Benar", "Akurasi"].forEach((h, i) => doc.text(h, cols[i], y, { lineBreak: false }));
  doc.font("Helvetica");
  for (const day of d.chart.daily) {
    y += 16;
    doc.fillColor(day.attempts ? "black" : GREY);
    [day.label, String(day.attempts), String(day.correct), day.attempts ? `${day.accuracy}%` : "-"]
      .forEach((t, i) => doc.text(t, cols[i], y, { lineBreak: false }));
    bar(doc, cols[4], y + 2, width - (cols[4] - left), 7, day.accuracy / 100);
  }
  doc.text("", left, y + 16);

  heading(doc, "Catatan AI");
  if (!d.ai) {
    doc.fillColor(GREY).text("Layanan AI sedang tidak tersedia saat laporan dibuat.").fillColor("black");
    return;
  }
  doc.text(d.ai.summary);
  if (d.ai.issues.length) {
    doc.moveDown(0.3).font("Helvetica-Bold").text("Perlu perhatian:").font("Helvetica");
    for (const i of d.ai.issues) doc.text(`• ${i.item}: ${i.problem}`, { indent: 10 });
  }
  if (d.ai.advice.length) {
    doc.moveDown(0.3).font("Helvetica-Bold").text("Saran:").font("Helvetica");
    for (const a of d.ai.advice) doc.text(`• ${a}`, { indent: 10 });
  }
}

/** One PDF for the whole classroom (or one child), one page per child. */
export async function classReportPdf(teacherId: string, classroomId?: string, days = 7, studentId?: string) {
  const classroom = await classroomOf(teacherId, classroomId);
  const { rows } = await db().query<Child>(
    `select id, nickname, total_points as "totalPoints" from students
      where classroom_id = $1 and ($2::uuid is null or id = $2) order by nickname`,
    [classroom.id, studentId ?? null],
  );
  // ponytail: all children in parallel (AI calls included); queue them if classes grow past ~30 children.
  const data = await Promise.all(rows.map((c) => childData(teacherId, c, days)));

  const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Laporan ${classroom.name}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const printed = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  if (!data.length) doc.fontSize(14).text(`Kelas ${classroom.name} belum punya siswa.`);
  data.forEach((d, i) => {
    if (i > 0) doc.addPage();
    childPage(doc, d, classroom.name, printed);
  });
  doc.end();
  return { pdf: await done, name: `laporan-${classroom.name}`.replace(/[^\w-]+/g, "-") + ".pdf" };
}
