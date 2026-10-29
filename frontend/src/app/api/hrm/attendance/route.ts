import { NextResponse } from "next/server";
import {
  getDailyAttendance,
  clearAllDailyAttendance,
} from "@/features/hrm/attendance/services/attendance.service";
import { apiHandler } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || "2026-09-25";
    const toDate = searchParams.get("toDate") || "2026-10-26";
    const viewBy = (searchParams.get("viewBy") as any) || "Employee";
    const employeeId = searchParams.get("employeeId") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const result = await getDailyAttendance({
      fromDate,
      toDate,
      viewBy,
      employeeId,
      status,
      pageSize,
      page,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Attendance API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load attendance records" },
      { status: 500 },
    );
  }
});

export const POST = apiHandler("employees:read", async (request) => {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: "Attendance adjustment request submitted successfully.",
      data: body,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update attendance" },
      { status: 500 },
    );
  }
});

export const DELETE = apiHandler("employees:read", async () => {
  try {
    clearAllDailyAttendance();
    return NextResponse.json({
      success: true,
      message: "All daily attendance data has been removed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear attendance data" },
      { status: 500 },
    );
  }
});

