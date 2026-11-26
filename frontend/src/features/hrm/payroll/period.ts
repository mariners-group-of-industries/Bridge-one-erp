/**
 * Payroll period helpers safe for the browser (no database). The company's
 * payroll month runs from the 21st to the 20th and is named after the month it
 * ends in ("November 2026" = 21 Oct – 20 Nov; "December 2026" = 21 Nov – 20 Dec),
 * matching the engine's default Payroll Rule. Salary is paid early in the month
 * after the period ends (21 Oct – 20 Nov → 5 Dec).
 */

export const DEFAULT_PERIOD_START_DAY = 21;
export const DEFAULT_PAY_DAY = 5;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The most recent payroll month whose period has ended on the given day, so the
 * form opens on the salary that is due: on 22 Nov or 5 Dec that is November
 * (21 Oct – 20 Nov), not the running 21 Nov – 20 Dec period (December).
 */
export function lastClosedPayrollMonth(today: Date = new Date(), startDay = DEFAULT_PERIOD_START_DAY): { year: string; month: string } {
  // A calendar-month period (start day 1) is closed once the month is over; otherwise the
  // period named after this month ends on the day before the start day.
  const back = startDay === 1 || today.getDate() < startDay ? 1 : 0;
  const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
  return { year: String(d.getFullYear()), month: pad(d.getMonth() + 1) };
}

/** Default payment date: the pay day of the month after the period ends (period to 20 Nov → 5 Dec). */
export function defaultPayrollDate(periodTo: string, payDay = DEFAULT_PAY_DAY): string {
  const [y, m] = periodTo.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, payDay)); // month index m = the month after periodTo's
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Period end of a payroll month under the default rule: "2026-11" → "2026-11-20". */
export function defaultPeriodEnd(month: string, startDay = DEFAULT_PERIOD_START_DAY): string {
  const [y, m] = month.split("-").map(Number);
  // The day before the start day in the named month; a calendar month (start day 1) ends on its last day.
  const d = startDay === 1 ? new Date(Date.UTC(y, m, 0)) : new Date(Date.UTC(y, m - 1, startDay - 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
