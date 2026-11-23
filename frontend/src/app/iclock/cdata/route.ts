import { admsRoute } from "@/features/configuration/gateways/attendance-device/server/adms-route";
import { admsHandshake, admsUpload } from "@/features/configuration/gateways/attendance-device/server/adms.service";

/** ZKTeco push (ADMS): handshake (GET) and punch upload (POST ?table=ATTLOG). */
export const GET = admsRoute((query) => admsHandshake(query.get("SN")));
export const POST = admsRoute((query, body) => admsUpload(query.get("SN"), query.get("table"), body));
