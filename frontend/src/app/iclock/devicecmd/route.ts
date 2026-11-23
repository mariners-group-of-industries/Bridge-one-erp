import { admsRoute } from "@/features/configuration/gateways/attendance-device/server/adms-route";
import { admsCommandResult } from "@/features/configuration/gateways/attendance-device/server/adms.service";

/** ZKTeco push (ADMS): command results. */
export const POST = admsRoute((query) => admsCommandResult(query.get("SN")));
