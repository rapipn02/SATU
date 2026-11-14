import { z } from "zod";

export const email = z.email("Email tidak valid").transform((value) => value.trim().toLowerCase());
export const password = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");
export const name = z.string().trim().min(1).max(100);

/**
 * Picture PIN: 3 taps on a fixed 3x3 grid of pictures numbered 1-9 (repeats allowed, order matters).
 * The number belongs to the picture, not its screen position, so every app must show the same 9 pictures.
 */
export const picturePassword = z.array(z.int().min(1).max(9)).length(3, "Pilih tepat 3 gambar");

/** Accepts 0812..., +62812..., 62812... (spaces/dashes ignored); stored as 62812... */
export const whatsappNumber = z
  .string()
  .transform((value) => value.replace(/[\s\-()]/g, "").replace(/^\+/, "").replace(/^0/, "62"))
  .pipe(z.string().regex(/^62[0-9]{8,13}$/, "Nomor WhatsApp tidak valid (contoh: 081234567890)"));

export const loginBody = z.object({ email, password: z.string().min(1).max(72) });

export const studentLoginBody = z.object({ studentId: z.uuid(), picturePassword });

/** Teacher creates the child's account (mobile app): form page, then the picture-PIN page, then one request. */
export const createStudentBody = z.object({
  nickname: z.string().trim().min(1).max(50),
  parentWhatsapp: whatsappNumber.optional(),
  birthDate: z.iso.date().optional(),
  photoUrl: z.string().max(700_000).optional(), // URL or small data URL (base64) from the camera/gallery
  picturePassword,
  classroomId: z.uuid().optional(), // default: the teacher's first class
  parentName: name.optional(), // default: "Orang tua {nickname}"
});

export const classroomQuery = z.object({ classroomId: z.uuid().optional() });
export const createClassroomBody = z.object({ name: z.string().trim().min(1).max(50) });

export const levelCapBody = z.object({ maxLevel: z.int().min(1).max(6).nullable() });

export const resetPicturePasswordBody = z.object({ picturePassword });

/** Teacher edits a child: new photo (URL or small data URL; null removes it) and/or nickname. */
export const updateStudentBody = z
  .object({
    nickname: z.string().trim().min(1).max(50).optional(),
    photoUrl: z.string().max(700_000).nullable().optional(),
  })
  .refine((b) => b.nickname !== undefined || b.photoUrl !== undefined, "Isi nickname atau photoUrl");

export const createInviteBody = z.object({
  parentName: name,
  studentIds: z.array(z.uuid()).min(1, "Pilih minimal satu anak"),
});

export const acceptInviteBody = z.object({ email, password });

/**
 * One attempt, in the shape the Mata component returns (HasilPercobaan, snake_case) plus `itemId`.
 * `bintang` and `poin` from the browser are accepted but ignored: the server recomputes stars.
 */
export const attemptBody = z.object({
  itemId: z.string().min(1).max(50),
  berhasil: z.boolean(),
  langkah_tercapai: z.int().min(0).max(50),
  durasi_ms: z.int().min(0).max(600_000).optional(),
  kemiripan: z.number().min(0).max(1),
  bintang: z.int().min(1).max(3).optional(),
  poin: z.number().optional(),
  homeworkItemId: z.uuid().optional(),
});

/** The personal lip model from Mata (ModelBibir). Extra fields (e.g. `pembaruan`) are kept. */
export const lipModelBody = z.looseObject({
  versi: z.literal(1),
  kelas: z.array(z.string()).min(2).max(10),
  pusat: z.array(z.array(z.number())).min(2).max(10),
  skala: z.array(z.number()).min(1).max(12),
  jumlah: z.array(z.int()).max(10).optional(),
  akurasi: z.number().min(0).max(1).optional(),
});

export const askBody = z.object({ question: z.string().trim().min(3).max(300) });

export const homeworkBody = z.object({
  studentId: z.uuid(),
  dueDate: z.iso.date().optional(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        levelId: z.string().min(1).optional(), // opsional; backend mencari level dari item
        item: z.string().min(1).max(50),
        requiredStars: z.int().min(1).max(3).optional(),
      }),
    )
    .min(1)
    .max(10),
});

const homeworkItems = z
  .array(
    z.object({
      levelId: z.string().min(1).optional(), // opsional; backend mencari level dari item
      item: z.string().min(1).max(50),
      requiredStars: z.int().min(1).max(3).optional(),
    }),
  )
  .min(1)
  .max(10);

export const homeworkBatchBody = z.object({
  dueDate: z.iso.date().optional(),
  note: z.string().max(500).optional(),
  assignments: z.array(z.object({ studentId: z.uuid(), items: homeworkItems })).min(1).max(100),
});

/** Number of days in a learning chart (default 7). */
export const chartQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });

export const homeworkStatus = z.enum(["assigned", "done"]);

export const createRewardBody = z.object({
  name: z.string().trim().min(1).max(100),
  costPoints: z.int().min(1),
  stock: z.int().min(0).nullable().optional(),
  imageUrl: z.string().max(2000).optional(),
});
