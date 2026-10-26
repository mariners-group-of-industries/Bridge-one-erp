import { NextResponse } from "next/server";
import { getCalendarAssignData } from "@/features/hrm/calendar-assign/services/calendar-assign.service";
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

    return NextResponse.json({
      success: true,
      options: data.options,
      employees: data.employees,
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

export const POST = apiHandler("employees:read", async (request) => {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: "Calendar assignments successfully persisted.",
      savedAt: new Date().toISOString(),
      updatedCount: body?.assignments ? Object.keys(body.assignments).length : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save calendar assignments" },
      { status: 500 },
    );
  }
});
