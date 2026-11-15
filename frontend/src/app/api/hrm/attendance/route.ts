import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDailyAttendance,
  submitAttendanceAdjustment,
  withdrawPendingAdjustments,
} from "@/features/hrm/attendance/services/attendance.service";
import { apiHandler, ok, parseJson } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || "2026-09-25";
    const toDate = searchParams.get("toDate") || "2026-10-26";
    const viewBy = (searchParams.get("viewBy") as any) || "Employee";
    const employeeId = searchParams.get("employeeId") || "ALL";
    const officeId = searchParams.get("officeId") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const result = await getDailyAttendance({
      fromDate,
      toDate,
      viewBy,
      employeeId,
      officeId,
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

const AdjustmentBody = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedStatus: z.string().min(1).max(20),
  inTime: z.string().max(20).nullish(),
  outTime: z.string().max(20).nullish(),
  remarks: z.string().max(500).nullish(),
  originalStatus: z.string().max(20).nullish(),
});

/** Submits a manual attendance adjustment; it waits in HR › Pending Approval › Attendance. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => {
  const body = await parseJson(request, AdjustmentBody);
  return ok(await submitAttendanceAdjustment(actor, body), 201);
});

/** Withdraws pending adjustments; device punches and decided adjustments are kept. */
export const DELETE = apiHandler("employees:read", async (_request, _context, actor) => {
  const withdrawn = await withdrawPendingAdjustments(actor);
  return NextResponse.json({ success: true, withdrawn, message: `${withdrawn} pending adjustment(s) withdrawn.` });
});
