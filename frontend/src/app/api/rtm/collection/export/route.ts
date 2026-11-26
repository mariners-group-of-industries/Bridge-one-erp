import { exportTableRoute } from "@/features/rtm/server/routes";

/** POST { format, title, headers, rows }: the list as shown, as an Excel file. */
export const POST = exportTableRoute();
