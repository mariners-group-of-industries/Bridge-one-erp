import { NextResponse } from "next/server";
import { z } from "zod";
import { getCalendarAssignData, loadCalendarDays, saveCalendarDays } from "@/features/hrm/calendar-assign/services/calendar-assign.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Employees for the grid, the filter options, and the days saved for them in the range (fromDate / toDate). */
export const GET = apiHandler("employees:read", async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const office = searchParams.get("office")?.trim() || undefined;
    const department = searchParams.get("department")?.trim() || undefined;
    const departmentSection = searchParams.get("departmentSection")?.trim() || undefined;
    const designation = searchParams.get("designation")?.trim() || undefined;
    const employeeId = searchParams.get("employeeId")?.trim() || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "40", 10);
    const fromDate = searchParams.get("fromDate") ?? "";
    const toDate = searchParams.get("toDate") ?? "";

    const data = await getCalendarAssignData({ office, department, departmentSection, designation, employeeId, search, page, limit });
    const assignments = ISO_DAY.test(fromDate) && ISO_DAY.test(toDate) ? await loadCalendarDays(data.employees.map((e) => e.id), fromDate, toDate) : {};

    return NextResponse.json({
      success: true,
      options: data.options,
      employees: data.employees,
      assignments,
      pagination: data.pagination,
      totalCount: data.pagination.total,
    });
  } catch (error: any) {
    console.error("Error in calendar-assign API:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load real employees" },
      { status: 500 },
    );
  }
});

const SaveBody = z.object({
  fromDate: z.string().regex(ISO_DAY),
  toDate: z.string().regex(ISO_DAY),
  /** employeeId → date → code ("" clears the day). */
  assignments: z.record(z.uuid(), z.record(z.string().regex(ISO_DAY), z.string().max(20))),
});

/** Saves the grid for the listed employees and range; each day becomes exactly what was sent. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const body = await parseJson(request, SaveBody);
  return ok(await saveCalendarDays(actor, { from: body.fromDate, to: body.toDate, assignments: body.assignments }));
});
