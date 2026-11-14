/** Turns the ML curriculum (GET /kurikulum + GET /anak/{id}/level) into the INSERT for the `levels` table. */

import { z } from "zod";

const mlItem = z.object({
  id: z.string(),
  tingkat: z.number(),
  teks: z.string(),
  urutan: z.array(z.string()),
  bantuan_visual: z.boolean(),
  level: z.number(),
  dinilai_sebagian: z.boolean(),
});
const kurikulumSchema = z.object({ item: z.array(mlItem).min(1) });
const levelSchema = z.object({ level: z.array(z.object({ level: z.number(), nama: z.string() })).min(1) });

type Category = "vokal" | "konsonan" | "suku_kata" | "kata";

/** Level 5 holds syllables (tingkat 3), level 6 words (tingkat 4); the rest are single sounds. */
function categoryOf(items: z.infer<typeof mlItem>[]): Category {
  const first = items[0];
  if (first.tingkat === 3) return "suku_kata";
  if (first.tingkat === 4) return "kata";
  return /^[aiueo]$/.test(first.urutan[0]) ? "vokal" : "konsonan";
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function levelsSql(kurikulumRaw: unknown, levelRaw: unknown): string {
  const kurikulum = kurikulumSchema.parse(kurikulumRaw);
  const names = new Map(levelSchema.parse(levelRaw).level.map((l) => [l.level, l.nama]));
  const numbers = [...new Set(kurikulum.item.map((i) => i.level))].sort((a, b) => a - b);

  const rows = numbers.map((nomor, index) => {
    const items = kurikulum.item.filter((i) => i.level === nomor);
    const json = JSON.stringify(
      items.map((i) => ({
        id: i.id,
        text: i.teks,
        tingkat: i.tingkat,
        urutan: i.urutan,
        bantuanVisual: i.bantuan_visual,
        dinilaiSebagian: i.dinilai_sebagian,
      })),
    );
    const previous = index === 0 ? "null" : quote(`level-${numbers[index - 1]}`);
    return `  (${quote(`level-${nomor}`)}, ${quote(categoryOf(items))}, ${nomor}, ${quote(names.get(nomor) ?? `Level ${nomor}`)}, ${quote(json)}::jsonb, ${previous})`;
  });

  return (
    "insert into public.levels (id, category, order_no, title, items, unlock_after_level_id) values\n" +
    `${rows.join(",\n")};`
  );
}
