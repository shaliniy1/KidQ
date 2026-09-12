// Supabase Auth for both UIs: the API verifies the access token and reads the role from
// app_metadata (which users cannot edit). Admins are created in the Supabase dashboard with
// app_metadata.role = "admin"; every other signed-in user is a parent.
// AUTH_MODE=dev also accepts `Bearer dev:<role>:<uuid>[:<email>]` (refused in production).
import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env";
import { ApiError } from "./errors";

export type Role = "admin" | "parent";

export interface AuthUser {
  id: string;
  email: string | null;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function roleFrom(payload: JWTPayload): Role {
  const appMetadata = payload.app_metadata as { role?: unknown } | undefined;
  return appMetadata?.role === "admin" ? "admin" : "parent";
}

async function verifySupabaseToken(token: string): Promise<AuthUser> {
  if (!env.supabaseUrl) throw new ApiError(500, "AUTH_NOT_CONFIGURED", "SUPABASE_URL is not configured.");
  const issuer = `${env.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  let payload: JWTPayload;
  try {
    // Newer projects sign with asymmetric keys (JWKS); legacy projects use the HS256 JWT secret.
    if (decodeProtectedHeader(token).alg === "HS256") {
      if (!env.supabaseJwtSecret) throw new Error("SUPABASE_JWT_SECRET missing");
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(env.supabaseJwtSecret), { issuer, audience: "authenticated" }));
    } else {
      jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
      ({ payload } = await jwtVerify(token, jwks, { issuer, audience: "authenticated" }));
    }
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token.");
  }
  if (!payload.sub) throw new ApiError(401, "UNAUTHENTICATED", "Token has no subject.");
  return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null, role: roleFrom(payload) };
}

function verifyDevToken(token: string): AuthUser {
  const [prefix, role, id, email] = token.split(":");
  if (prefix !== "dev" || (role !== "admin" && role !== "parent") || !UUID.test(id ?? "")) {
    throw new ApiError(401, "UNAUTHENTICATED", "Dev tokens look like dev:<admin|parent>:<uuid>[:<email>].");
  }
  return { id, email: email ?? `${role}@dev.local`, role };
}

/** Attaches req.user when a bearer token is present; routes decide whether one is required. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next();
  const token = header.slice("Bearer ".length).trim();
  const verify = env.authMode === "dev" && token.startsWith("dev:") ? Promise.resolve(verifyDevToken(token)) : verifySupabaseToken(token);
  verify
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "UNAUTHENTICATED", "Sign in required."));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, "FORBIDDEN", "Your role cannot use this endpoint."));
    next();
  };
}

export function actorName(user: AuthUser): string {
  return user.email ?? user.id;
}
