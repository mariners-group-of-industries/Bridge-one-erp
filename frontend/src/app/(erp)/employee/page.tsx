import { redirect } from "next/navigation";

/** /employee opens the employee's dashboard. */
export default function EmployeeHome() {
  redirect("/employee/dashboard");
}
