import { NextResponse } from "next/server";
import { getCalendarAssignData } from "@/features/hrm/calendar-assign/services/calendar-assign.service";
import { getCalendarDays, saveCalendarDays } from "@/features/hrm/calendar-assign/services/calendar-days.service";
import { AppError } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";

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
    const fromDate = searchParams.get("fromDate")?.trim() || "";
    const toDate = searchParams.get("toDate")?.trim() || "";

    const data = await getCalendarAssignData({
      office,
      department,
      departmentSection,
      designation,
      employeeId,
      search,
      page,
      limit,
    });
    // Saved calendars of the employees on this page, for the chosen days.
    const assignments = await getCalendarDays(data.employees.map((e) => e.id), fromDate, toDate);

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

export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await saveCalendarDays(actor, body?.changes ?? []);
    return NextResponse.json({
      success: true,
      message: "Calendar assignments saved.",
      savedAt: new Date().toISOString(),
      updatedCount: result.saved + result.cleared,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.status : 500;
    if (status === 500) console.error("Error saving calendar assignments:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save calendar assignments" },
      { status },
    );
  }
});
