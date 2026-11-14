const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value from a form is a real record id. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** A record id from a form, or null when it is missing or not a real id. */
export function uuidOrNull(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

/** A yyyy-mm-dd date from a form as a UTC date, or null when it is not one. */
export function isoDateOrNull(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
