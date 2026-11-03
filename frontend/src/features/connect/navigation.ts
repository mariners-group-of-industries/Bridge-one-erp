import { MessageSquareText } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { connectPaths } from "./paths";

export const chatLink: NavLink = {
  label: "BRG Connect Chat",
  href: connectPaths.chat,
  description: "Enterprise real-time chat, channels, direct messages, and embedded ERP cards.",
  keywords: ["connect", "chat", "messages", "realtime", "channels", "conversations"],
};

export const directoryLink: NavLink = {
  label: "Employee Directory",
  href: connectPaths.directory,
  description: "Company-wide employee directory lookup by department, role, and branch with 1-click chat.",
  keywords: ["directory", "employees", "team", "colleagues", "staff", "contacts"],
};

export const callsLink: NavLink = {
  label: "Calls & Meetings",
  href: connectPaths.calls,
  description: "Audio/Video call history, active meetings, and WebRTC P2P communication logs.",
  keywords: ["calls", "webrtc", "video", "audio", "meetings", "conferencing"],
};

export const docsLink: NavLink = {
  label: "Architecture & Spec",
  href: connectPaths.docs,
  description: "Technical architecture, WebSocket protocol, Redis pub/sub, MinIO storage, and WebRTC Coturn guide.",
  keywords: ["architecture", "spec", "api", "websocket", "redis", "coturn", "webrtc", "minio"],
};

export const connectWorkspace: Workspace = {
  id: "connect",
  label: "BRG Connect",
  icon: MessageSquareText,
  href: connectPaths.chat,
  description: "Integrated enterprise team messaging, channels, ERP workflow cards, and WebRTC audio/video calling.",
  status: "active",
  shortcuts: [chatLink, directoryLink, callsLink, docsLink],
  cards: [
    {
      label: "",
      links: [chatLink, directoryLink, callsLink, docsLink],
    },
  ],
};
