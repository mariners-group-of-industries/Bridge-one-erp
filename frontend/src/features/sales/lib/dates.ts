/** "YYYY-MM-DD" → the UTC midnight Prisma uses for @db.Date columns. */
export function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** @db.Date value → "YYYY-MM-DD". */
export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
