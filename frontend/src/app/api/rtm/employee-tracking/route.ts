import { employeeTracking, recordVisit } from "@/features/rtm/server/field.service";
import { get, write } from "@/features/rtm/server/routes";

/** ?date&employeeId: the field day. POST records a check-in / visit / check-out. */
export const GET = get((actor, q) => employeeTracking(actor, q.date ?? "", q.employeeId));
export const POST = write((actor, body) => recordVisit(actor, body), 201);
