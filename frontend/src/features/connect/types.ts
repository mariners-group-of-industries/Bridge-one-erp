export type PresenceStatus = "online" | "away" | "offline";

export interface ConnectUser {
  id: string;
  name: string;
  avatar?: string;
  department: string;
  designation: string;
  phone: string;
  email: string;
  officeName: string;
  status: PresenceStatus;
  lastSeen?: string;
  role: "admin" | "member";
}

export interface ConnectAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
  type: "image" | "file" | "doc" | "audio";
}

export type ErpRecordType =
  | "PURCHASE_ORDER"
  | "REQUISITION"
  | "SALES_INVOICE"
  | "INVENTORY_ITEM"
  | "LEAVE_APPLICATION";

export interface ErpRecordCard {
  type: ErpRecordType;
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  amount?: string;
  status: string;
  statusColor?: "emerald" | "amber" | "blue" | "rose" | "purple";
  link: string;
}

export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "seen";

export interface ConnectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  clientMsgId: string;
  type: "text" | "file" | "image" | "system" | "erp_card" | "call";
  body: string;
  replyTo?: {
    id: string;
    senderName: string;
    body: string;
  };
  erpRecord?: ErpRecordCard;
  attachments?: ConnectAttachment[];
  callInfo?: {
    type: "audio" | "video";
    status: "completed" | "missed" | "rejected";
    durationSec?: number;
  };
  status: MessageDeliveryStatus;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface ConnectConversation {
  id: string;
  type: "direct" | "group";
  name: string;
  avatar?: string;
  description?: string;
  peerId?: string;
  members: string[]; // user IDs
  memberUsers?: ConnectUser[];
  unreadCount: number;
  lastMessage?: ConnectMessage;
  isMuted?: boolean;
  isPinned?: boolean;
  department?: string;
  createdById?: string;
  createdAt: string;
}

export interface ConnectCallSession {
  id: string;
  conversationId: string;
  conversationName: string;
  caller: ConnectUser;
  participants: ConnectUser[];
  type: "audio" | "video";
  status: "calling" | "ringing" | "connected" | "ended";
  startedAt: string;
  durationSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}
