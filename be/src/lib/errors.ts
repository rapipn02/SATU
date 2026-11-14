import type { ErrorRequestHandler } from "express";

export class AppError extends Error {
  readonly status: number;
  readonly errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const unauthorized = (message: string) => new AppError(401, message);
export const forbidden = (message: string) => new AppError(403, message);
export const notFound = (message: string) => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);

/** Exceptions raised inside the SQL functions in supabase/migrations/001_init.sql. */
const SQL_FUNCTION_ERRORS: Record<string, [number, string]> = {
  HOMEWORK_ITEM_NOT_FOUND: [404, "Item PR tidak ditemukan"],
  HOMEWORK_ITEM_MISMATCH: [400, "Percobaan tidak sesuai dengan item PR"],
  INVALID_STARS: [400, "Bintang harus 0 sampai 3"],
  REWARD_NOT_FOUND: [404, "Hadiah tidak ditemukan"],
  OUT_OF_STOCK: [409, "Stok hadiah habis"],
  NOT_ENOUGH_POINTS: [400, "Poin belum cukup"],
};

const POSTGRES_ERRORS: Record<string, [number, string]> = {
  "23505": [409, "Data sudah ada"],
  "23503": [400, "Data rujukan tidak valid"],
  "22P02": [404, "Tidak ditemukan"], // malformed uuid in a path parameter
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    // Rejected writes are logged (pm2 logs) so app bugs are visible on the server; reads stay quiet.
    if (req.method !== "GET" && error.status !== 401 && process.env.NODE_ENV !== "test") {
      console.warn(`[${error.status}] ${req.method} ${req.originalUrl}: ${error.message}`, error.errors ?? "",
        req.originalUrl.includes("/homework") ? `body=${JSON.stringify(req.body).slice(0, 500)}` : "");
    }
    res.status(error.status).json({ detail: error.message, ...(error.errors ? { errors: error.errors } : {}) });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ detail: "JSON tidak valid" });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ detail: "Data terlalu besar" });
    return;
  }
  const known = SQL_FUNCTION_ERRORS[error?.message] ?? POSTGRES_ERRORS[error?.code];
  if (known) {
    res.status(known[0]).json({ detail: known[1] });
    return;
  }
  console.error(error);
  res.status(500).json({ detail: "Terjadi kesalahan di server" });
};
