import { describe, expect, it } from "vitest";
import { checkApiAccess } from "@/lib/permissions/api-rules";
import { grantsFromList, permissionKey } from "@/lib/permissions/registry";

/**
 * Attendance access: an employee sees only their own attendance in Employee
 * Self Service; HRM's attendance system (everyone's rows, adjustments,
 * calendar assignment) needs its own HRM permission, action by action.
 */
const keys = (page: string, actions: string[]) => actions.map((a) => permissionKey(page, a as "view"));
const allowed = (grants: ReturnType<typeof grantsFromList>, method: string, path: string) => checkApiAccess(grants, method, path).allowed;

describe("Attendance permissions", () => {
  it("an employee with Employee Self Service only reaches their own attendance", () => {
    // The ESS_BASE group: Leave & Movement and Profile, no HRM › Attendance.
    const ess = grantsFromList([...keys("/hrm/self-service/leave-movement", ["view", "create", "edit"]), ...keys("/hrm/self-service/profile", ["view", "edit"])] as never);
    expect(allowed(ess, "GET", "/api/ess/attendance")).toBe(true);
    expect(allowed(ess, "POST", "/api/ess/attendance-corrections")).toBe(true);
    expect(allowed(ess, "GET", "/api/hrm/self-service/attendance-requests")).toBe(true);
    for (const [method, path] of [
      ["GET", "/api/hrm/attendance"],
      ["POST", "/api/hrm/attendance"],
      ["DELETE", "/api/hrm/attendance"],
      ["POST", "/api/hrm/calendar-assign"],
      ["GET", "/api/hrm/governance/pending"],
    ])
      expect(allowed(ess, method, path), `${method} ${path}`).toBe(false);
  });

  it("viewing HRM attendance does not allow changing it", () => {
    const viewer = grantsFromList([...keys("/hrm/attendance", ["view"]), ...keys("/hrm/calendar-assign", ["view"])] as never);
    expect(allowed(viewer, "GET", "/api/hrm/attendance")).toBe(true);
    expect(allowed(viewer, "POST", "/api/hrm/attendance")).toBe(false); // adjustment = Create
    expect(allowed(viewer, "DELETE", "/api/hrm/attendance")).toBe(false); // withdraw = Delete
    expect(allowed(viewer, "POST", "/api/hrm/calendar-assign")).toBe(false); // save = Create
    const editor = grantsFromList([...keys("/hrm/attendance", ["view", "create"]), ...keys("/hrm/calendar-assign", ["view", "create"])] as never);
    expect(allowed(editor, "POST", "/api/hrm/attendance")).toBe(true);
    expect(allowed(editor, "POST", "/api/hrm/calendar-assign")).toBe(true);
  });
});
