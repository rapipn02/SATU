/**
 * Writes API-LENGKAP.md: the same content as /docs (Swagger), as one Markdown file the mobile
 * teammate can read top to bottom. Built from the route registry + the recorded real examples,
 * so it never drifts from the code.   npm run docs:md
 */
import { writeFileSync } from "node:fs";
import { Router } from "express";
import { openApiDocument } from "../src/lib/openapi";
import { TAGS } from "../src/lib/route";
import { apiRouter } from "../src/routes";

apiRouter(); // fills the route registry
void Router;

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  anyOf?: Schema[];
  oneOf?: Schema[];
  pattern?: string;
  default?: unknown;
};
type Op = {
  tags: string[];
  summary: string;
  description: string;
  security?: unknown[];
  parameters: { name: string; in: string; description?: string; schema?: Schema }[];
  requestBody?: { content: { "application/json": { schema: Schema; example?: unknown } } };
  responses: Record<string, { content?: { "application/json": { example?: unknown } } }>;
};

const BASE = "https://tunarungu.neotelemetri.id/api";
const doc = openApiDocument();
const out: string[] = [];
const w = (s = "") => out.push(s);

const typeOf = (s: Schema | undefined): string => {
  if (!s) return "any";
  if (s.anyOf || s.oneOf) return (s.anyOf ?? s.oneOf)!.map(typeOf).join(" atau ");
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" \\| ");
  const t = Array.isArray(s.type) ? s.type.join(" atau ") : (s.type ?? "object");
  if (t === "array") return `array of ${typeOf(s.items)}`;
  return s.format ? `${t} (${s.format})` : t;
};

const aturan = (s: Schema): string => {
  const r: string[] = [];
  if (s.minimum !== undefined) r.push(`min ${s.minimum}`);
  if (s.maximum !== undefined) r.push(`maks ${s.maximum}`);
  if (s.minLength !== undefined) r.push(`panjang min ${s.minLength}`);
  if (s.maxLength !== undefined) r.push(`panjang maks ${s.maxLength}`);
  if (s.minItems !== undefined) r.push(`min ${s.minItems} isi`);
  if (s.maxItems !== undefined) r.push(`maks ${s.maxItems} isi`);
  if (s.items?.minimum !== undefined) r.push(`tiap isi ${s.items.minimum}–${s.items.maximum}`);
  if (s.format === "date") r.push("format YYYY-MM-DD");
  else if (s.format === "uuid") r.push("UUID");
  else if (s.format === "email") r.push("email valid");
  else if (s.pattern) r.push(`pola \`${s.pattern}\``);
  return r.join(", ");
};

/** Field table, nested objects flattened as `parent.child` / `items[].child`. */
function fields(s: Schema, prefix = ""): string[] {
  const rows: string[] = [];
  const target = s.type === "array" && s.items ? s.items : s;
  const p = s.type === "array" ? `${prefix}[]` : prefix;
  for (const [name, f] of Object.entries(target.properties ?? {})) {
    const key = p ? `${p}.${name}` : name;
    const wajib = (target.required ?? []).includes(name) ? "ya" : "tidak";
    rows.push(`| \`${key}\` | ${typeOf(f)} | ${wajib} | ${aturan(f)} |`);
    const inner = f.type === "array" ? f.items : f;
    if (inner?.properties) rows.push(...fields(f, key));
  }
  return rows;
}

const json = (v: unknown, max = 60) => {
  // Short arrays of numbers/strings on one line, like [2, 5, 8].
  const atom = String.raw`(?:-?[\d.]+|"[^"\n]{0,24}"|true|false|null)`;
  const shortArray = new RegExp(String.raw`\[\s*(${atom}(?:,\s*${atom})*)\s*\]`, "g");
  const text = JSON.stringify(v, null, 2).replace(shortArray, (_m, inner: string) => `[${inner.split(/,\s*/).join(", ")}]`);
  const lines = text.split("\n");
  return lines.length > max ? [...lines.slice(0, max), "  … (dipotong, lihat /docs untuk lengkapnya)"].join("\n") : lines.join("\n");
};

// ------------------------------------------------------------------ header + guide

w("# SATU API — dokumentasi lengkap");
w();
w(`Base URL: \`${BASE}\` · Swagger interaktif: \`https://tunarungu.neotelemetri.id/docs\``);
w();
w("Isi file ini sama dengan Swagger: dibuat otomatis dari kode backend dan contoh respons asli (`npm run docs:md`).");
w("Contoh respons memakai data contoh (nama Raka, Sinta, Bu Rina); id di contoh **bukan** id asli di server.");
w();
w("## Daftar isi");
const tagList = Object.values(TAGS);
for (const t of tagList) w(`- [${t}](#${t.toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-")})`);
w();
w((doc.info.description as string).trim().replace(/\\`/g, "`"));
w();

// ------------------------------------------------------------------ endpoints per app

for (const tag of tagList) {
  const desc = doc.tags.find((t) => t.name === tag)?.description ?? "";
  w(`---`);
  w();
  w(`## ${tag}`);
  w();
  w(desc);
  w();
  const ops: [string, string, Op][] = [];
  for (const [p, methods] of Object.entries(doc.paths)) {
    for (const [m, op] of Object.entries(methods as Record<string, Op>)) if (op.tags.includes(tag)) ops.push([m, p, op]);
  }
  w("| Method | Endpoint | Fungsi |");
  w("|---|---|---|");
  for (const [m, p, op] of ops) w(`| ${m.toUpperCase()} | \`${p}\` | ${op.summary} |`);
  w();

  for (const [m, p, op] of ops) {
    w(`### ${m.toUpperCase()} \`${p}\``);
    w();
    w(`**${op.summary}**`);
    w();
    const auth = op.security ? op.description.replace(/🔒 Butuh token \*\*(.+)\*\*\./, "Butuh token **$1** (`Authorization: Bearer <token>`)") : "Tanpa login.";
    w(`- Login: ${auth}`);
    const pathParams = op.parameters.filter((x) => x.in === "path");
    const query = op.parameters.filter((x) => x.in === "query");
    if (pathParams.length) w(`- Parameter path: ${pathParams.map((x) => `\`{${x.name}}\` = ${x.description ?? x.name}`).join(", ")}`);
    if (query.length) {
      w(`- Parameter query (opsional): ${query.map((x) => `\`${x.name}\` (${typeOf(x.schema)})`).join(", ")}`);
    }
    w();

    const body = op.requestBody?.content["application/json"];
    if (body) {
      const rows = fields(body.schema);
      if (rows.length) {
        w("**Body (JSON):**");
        w();
        w("| Field | Tipe | Wajib | Aturan |");
        w("|---|---|---|---|");
        rows.forEach((r) => w(r));
        w();
      }
      if (body.example !== undefined) {
        w("Contoh body:");
        w("```json");
        w(json(body.example));
        w("```");
        w();
      }
    }

    const [status, res] = Object.entries(op.responses).find(([k]) => k !== "default") ?? ["200", {}];
    const example = res.content?.["application/json"]?.example;
    w(`**Respons ${status}:**`);
    if (example !== undefined) {
      w("```json");
      w(json(example));
      w("```");
    } else {
      w("_(lihat Swagger)_");
    }
    w();

    // curl so the teammate can try it right away
    const url = BASE + p.replace(/^\/api/, "");
    const curl = [`curl -X ${m.toUpperCase()} "${url}"`];
    if (op.security) curl.push(`  -H "Authorization: Bearer $TOKEN"`);
    if (body) curl.push(`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(body.example ?? {})}'`);
    w("<details><summary>Coba dengan curl</summary>");
    w();
    w("```bash");
    w(curl.join(" \\\n"));
    w("```");
    w();
    w("</details>");
    w();
  }
}

writeFileSync(new URL("../API-LENGKAP.md", import.meta.url), out.join("\n"));
console.log(`API-LENGKAP.md ditulis (${out.length} baris)`);
