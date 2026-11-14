/**
 * HTTP client for the ML teammate's service (aisatu-main/backend, FastAPI).
 *
 * Every call is best effort: it returns `null` when the service is not configured, down, slow,
 * or answers in an unexpected shape, so routes always have a rule-based fallback and the
 * teacher and parent apps never break during the demo. It never throws.
 */

import { z } from "zod";
import { config } from "../config";

// ---------------------------------------------------------------- response shapes
// Loose objects: only the fields we use are checked; everything else is passed through to the apps.

export const mlItemSchema = z.object({
  id: z.string(),
  tingkat: z.number(),
  teks: z.string(),
  urutan: z.array(z.string()),
  bantuan_visual: z.boolean(),
  level: z.number(),
  dinilai_sebagian: z.boolean(),
});
export type MlItem = z.infer<typeof mlItemSchema>;

const mlNext = z.looseObject({
  item: mlItemSchema,
  perkiraan_berhasil: z.number(),
  alasan: z.string(),
  istirahat: z.boolean(),
});

export type MlNext = z.infer<typeof mlNext>;

export const mlLevelSchema = z.looseObject({
  level_sekarang: z.number(),
  level: z.array(
    z.looseObject({
      level: z.number(),
      nama: z.string(),
      kemajuan: z.number(),
      bintang: z.number(),
      status: z.enum(["tuntas", "terbuka", "terkunci"]),
    }),
  ),
});

export const mlSessionSchema = z.looseObject({ berikutnya: mlNext });

export const mlAttemptSchema = z.looseObject({
  perubahan: z.array(
    z.looseObject({ bunyi: z.string(), tingkat: z.number(), berhasil: z.boolean(), sebelum: z.number(), sesudah: z.number(), label: z.string() }),
  ),
  lelah: z.looseObject({ lelah: z.boolean(), alasan: z.array(z.string()) }),
  berikutnya: mlNext,
});

export const mlMapSchema = z.looseObject({
  bunyi: z.array(z.looseObject({ bunyi: z.string(), label: z.string() })),
  insight: z.looseObject({ macet: z.array(z.looseObject({ bunyi: z.string() })), naik: z.array(z.looseObject({ bunyi: z.string() })) }),
  level: z.looseObject({
    level_sekarang: z.number(),
    level: z.array(z.looseObject({ level: z.number(), nama: z.string() })),
  }),
});

export const mlTaskSchema = z.looseObject({
  tugas: z.array(z.looseObject({ item: mlItemSchema, alasan: z.string(), label: z.string() })),
  sumber: z.string(),
});

export const mlAdviceSchema = z.looseObject({ fokus: z.array(z.looseObject({ bunyi: z.string() })), saran: z.array(z.looseObject({ teks: z.string() })), sumber: z.string() });
export const mlClassSchema = z.looseObject({ ringkasan: z.string(), sumber: z.string() });
export const mlReportSchema = z.looseObject({ sumber: z.string() });
export const mlAskSchema = z.looseObject({ jawaban: z.string(), sumber: z.string() });
export const mlHistorySchema = z.looseObject({ harian: z.array(z.looseObject({ tanggal: z.string() })) });
export const mlModelSchema = z.looseObject({ model: z.unknown() });

// ---------------------------------------------------------------- transport

export const mlEnabled = () => Boolean(config.AI_URL);

interface Options {
  body?: unknown;
  /** Endpoints that call the LLM get the longer timeout. */
  llm?: boolean;
}

/** GET/POST to the ML service and validate the answer. `null` on any failure. */
export async function ml<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT",
  path: string,
  schema: S,
  { body, llm = false }: Options = {},
): Promise<z.infer<S> | null> {
  if (!config.AI_URL) return null;
  try {
    const response = await fetch(`${config.AI_URL.replace(/\/$/, "")}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(llm ? config.AI_LLM_TIMEOUT_MS : config.AI_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Unvalidated GET for the curriculum sync script (which should fail loudly instead of falling back). */
export async function mlFetchRaw(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
}

/** Child ids in the ML service are the Supabase student ids. */
export const childPath = (studentId: string, rest: string) => `/anak/${studentId}${rest}`;
