import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config";

/** "device": the class laptop; its id is a classroom id. It can only list that class and log its students in. */
export type Role = "teacher" | "parent" | "student" | "device";
export type Source = "school" | "home";

export interface Principal {
  id: string;
  role: Role;
  src?: Source; // students only: practising on the class laptop or at home
}

const TOKEN_TTL_SECONDS: Record<Role, number> = {
  teacher: 7 * 24 * 3600,
  parent: 30 * 24 * 3600,
  student: 3 * 3600, // one practice session
  device: 90 * 24 * 3600,
};

export const hashPassword = (password: string) => bcrypt.hash(password, config.PASSWORD_BCRYPT_ROUNDS);
export const hashPicturePassword = (indices: number[]) =>
  bcrypt.hash(indices.join("-"), config.PICTURE_BCRYPT_ROUNDS);
export const verifyHash = (secret: string, hash: string) => bcrypt.compare(secret, hash);
export const pictureSecret = (indices: number[]) => indices.join("-");

export function signToken(principal: Principal): string {
  return jwt.sign({ role: principal.role, src: principal.src }, config.JWT_SECRET, {
    subject: principal.id,
    expiresIn: TOKEN_TTL_SECONDS[principal.role],
  });
}

export function verifyToken(token: string): Principal {
  const claims = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  return { id: String(claims.sub), role: claims.role, src: claims.src };
}

/** Invite links carry the raw token; the database stores only its SHA-256 (hex). */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: sha256(token) };
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
