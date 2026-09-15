// One error shape for every route: { error: { code, message, details } } (plan: API contract).
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { redactText } from "../connectors/http";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found.`);

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details ?? null } });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Request validation failed.", details: error.issues } });
  }
  const bodyError = error as { type?: string };
  if (bodyError.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON.", details: null } });
  }
  if (bodyError.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "BODY_TOO_LARGE", message: "Request body is too large.", details: null } });
  }
  console.error(`[api] ${redactText(error instanceof Error ? (error.stack ?? error.message) : String(error))}`);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong.", details: null } });
}
