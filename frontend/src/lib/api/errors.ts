export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IN_USE"
  | "PRECONDITION_REQUIRED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
  };
}

/** An expected, client-safe error. Its message is returned to the caller. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (entity: string) =>
  new AppError(404, "NOT_FOUND", `${entity} not found.`);

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError(409, "CONFLICT", message, details);

export const inUse = (message: string, details?: Record<string, unknown>) =>
  new AppError(409, "IN_USE", message, details);

export const badRequest = (message: string) =>
  new AppError(400, "VALIDATION_ERROR", message);
