import { admsRoute } from "@/features/configuration/gateways/attendance-device/server/adms-route";
import { admsPoll } from "@/features/configuration/gateways/attendance-device/server/adms.service";

/** ZKTeco push (ADMS): the device's heartbeat, asking for commands. */
export const GET = admsRoute((query) => admsPoll(query.get("SN")));
