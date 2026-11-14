import type { Request, Router } from "express";
import { z, type ZodType } from "zod";
import { AppError } from "./errors";
import { type Principal, type Role, verifyToken } from "./security";

type Method = "get" | "post" | "put" | "patch" | "delete";

/** Swagger groups ("boxes"), one per app that calls the API. Order here = order on /docs. */
export const TAGS = {
  guru: "Aplikasi Guru (mobile)",
  ortu: "Aplikasi Orang Tua (mobile)",
  anak: "Web Anak (laptop sekolah)",
} as const;
export type Tag = (typeof TAGS)[keyof typeof TAGS];

export interface RouteContext<Body, Query> {
  req: Request;
  /** Set when the route declares `auth`; routes without `auth` must not read it. */
  user: Principal;
  body: Body;
  query: Query;
  params: Record<string, string>;
}

export interface RouteDef<B extends ZodType, Q extends ZodType> {
  method: Method;
  path: string;
  /** One or more app boxes on /docs (an endpoint used by two apps appears in both). */
  tag: Tag | Tag[];
  summary: string;
  auth?: Role | Role[];
  body?: B;
  query?: Q;
  status?: number;
  handler: (ctx: RouteContext<z.infer<B>, z.infer<Q>>) => unknown;
}

/** Every declared route, used to build the OpenAPI document served at /docs. */
export const registry: RouteDef<ZodType, ZodType>[] = [];

function parse<T extends ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    throw new AppError(400, "Data tidak valid", errors);
  }
  return result.data;
}

export function authenticate(req: Request, roles: Role | Role[]): Principal {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) throw new AppError(401, "Butuh login");
  let principal: Principal;
  try {
    principal = verifyToken(token);
  } catch {
    throw new AppError(401, "Token tidak valid atau kedaluwarsa");
  }
  if (![roles].flat().includes(principal.role)) throw new AppError(403, "Peran ini tidak boleh mengakses endpoint ini");
  return principal;
}

/** Return this from a handler to send a download (e.g. a PDF) instead of JSON. */
export class FileResult {
  constructor(readonly data: Buffer, readonly type: string, readonly name: string) {}
}

/** Registers one endpoint: auth by role, zod-validated body/query, JSON response (or a FileResult download). */
export function route<B extends ZodType = ZodType<undefined>, Q extends ZodType = ZodType<undefined>>(
  router: Router,
  def: RouteDef<B, Q>,
): void {
  if (!registry.some((r) => r.method === def.method && r.path === def.path)) {
    registry.push(def as unknown as RouteDef<ZodType, ZodType>);
  }
  router[def.method](def.path, async (req, res) => {
    const user = def.auth ? authenticate(req, def.auth) : (undefined as unknown as Principal);
    const body = def.body ? parse(def.body, req.body) : undefined;
    const query = def.query ? parse(def.query, req.query) : undefined;
    const result = await def.handler({
      req,
      user,
      body: body as z.infer<B>,
      query: query as z.infer<Q>,
      params: req.params as Record<string, string>,
    });
    if (result instanceof FileResult) {
      res.status(200).type(result.type).attachment(result.name).send(result.data);
      return;
    }
    res.status(def.status ?? 200).json(result ?? null);
  });
}
