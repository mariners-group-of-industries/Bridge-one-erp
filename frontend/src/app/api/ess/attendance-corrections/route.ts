import { myCorrections } from "@/features/ess/server/ess-attendance.service";
import { requestCorrection } from "@/features/ess/server/ess.service";
import { apiHandler, ok } from "@/lib/api/handler";

export const GET = apiHandler("employees:read", async (_request, _context, actor) => ok(await myCorrections(actor)));

/** { date, correctionType, requestedStatus, inTime, outTime, reason }: waits for HR approval. */
export const POST = apiHandler("employees:read", async (request, _context, actor) => ok(await requestCorrection(actor, await request.json().catch(() => ({}))), 201));
