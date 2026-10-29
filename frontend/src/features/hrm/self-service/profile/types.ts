/** One row of HRM › Self Service › Profile (Basic Information). */
export interface ProfileRow {
  id: string;
  code: string;
  name: string;
  designation: string | null;
  department: string | null;
  employeeType: string | null;
  /** YYYY-MM-DD */
  joiningDate: string;
  supervisor: string | null;
}

/** The employee record(s) linked to the signed-in account. */
export interface ProfileList {
  rows: ProfileRow[];
}
