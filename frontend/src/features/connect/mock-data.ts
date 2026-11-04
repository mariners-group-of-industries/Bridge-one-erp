import type {
  ConnectConversation,
  ConnectMessage,
  ConnectUser,
  ErpRecordCard,
} from "./types";

export const DEFAULT_CURRENT_USER: ConnectUser = {
  id: "user-current",
  name: "Current User",
  department: "Management",
  designation: "Executive",
  phone: "",
  email: "",
  officeName: "Head Office",
  status: "online",
  role: "admin",
};

export const EMPTY_CONVERSATIONS: ConnectConversation[] = [];
export const EMPTY_MESSAGES: Record<string, ConnectMessage[]> = {};
export const EMPTY_ERP_RECORDS: ErpRecordCard[] = [];
