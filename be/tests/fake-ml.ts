/**
 * A stand-in for the ML teammate's service. Answers are recorded from the real service
 * (tests/fixtures/ml.json), so shapes match; behaviour is minimal:
 *  - a child is "blank" until the fake has received an attempt for them,
 *  - `mode = "down"` drops every connection, like a stopped service,
 *  - `forget()` simulates a restart that wipes the in-memory state.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";

export const fixtures = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "fixtures/ml.json"), "utf8"),
) as Record<string, any>;

export interface Call {
  method: string;
  path: string;
  body: any;
}

class FakeMl {
  server: Server | null = null;
  calls: Call[] = [];
  mode: "ok" | "down" = "ok";
  private seen = new Map<string, number>();

  get url(): string {
    return `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}/ai`;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        if (this.mode === "down") return req.socket.destroy();
        const body = raw ? JSON.parse(raw) : undefined;
        const url = (req.url ?? "").replace(/^\/ai/, "");
        this.calls.push({ method: req.method ?? "", path: url, body });
        const [status, payload] = this.answer(req.method ?? "", url, body);
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(payload));
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    process.env.AI_URL = this.url;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  /** Between tests: forget calls and children, bring the service back up. */
  reset(): void {
    this.calls = [];
    this.mode = "ok";
    this.seen.clear();
  }

  /** The service restarted: every child is blank again, but the calls log is kept. */
  forget(): void {
    this.seen.clear();
  }

  callsTo(method: string, pattern: RegExp): Call[] {
    return this.calls.filter((c) => c.method === method && pattern.test(c.path));
  }

  private answer(method: string, url: string, body: any): [number, unknown] {
    if (url === "/kelas/ringkasan") return [200, fixtures.kelas_ringkasan];
    if (url === "/kurikulum") return [200, fixtures.kurikulum];
    const match = url.match(/^\/anak\/([^/]+)\/(.+)$/);
    if (!match) return [404, { detail: "unknown" }];
    const [, id, rest] = match;
    const practised = (this.seen.get(id) ?? 0) > 0;

    switch (`${method} ${rest}`) {
      case "GET level":
        return [200, practised ? fixtures.level : fixtures.level_kosong];
      case "GET peta":
        return [200, practised ? fixtures.peta : fixtures.peta_kosong];
      case "GET riwayat":
        return [200, fixtures.riwayat];
      case "GET model-bibir":
        return [200, fixtures.model_kosong];
      case "PUT model-bibir":
        return [200, { tersimpan: true, kelas: body?.model?.kelas ?? [] }];
      case "POST sesi":
        return [200, fixtures.sesi];
      case "POST percobaan":
        if (!fixtures.kurikulum.item.some((i: { id: string }) => i.id === body?.item_id)) return [404, { detail: "item" }];
        this.seen.set(id, (this.seen.get(id) ?? 0) + 1);
        return [200, body.berhasil ? fixtures.percobaan : fixtures.percobaan_gagal];
      case "POST tugas-usulan":
        return [200, fixtures.tugas_usulan];
      case "POST saran-belajar":
        return [200, fixtures.saran_belajar];
      case "POST laporan-mingguan":
        return [200, fixtures.laporan_mingguan];
      case "POST tanya":
        return [200, fixtures.tanya];
      default:
        return [404, { detail: "unknown" }];
    }
  }
}

export const fakeMl = new FakeMl();
