"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Info,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneOff,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Share2,
  Trash2,
  Users,
  Video,
  VideoOff,
  X,
  Edit2,
  Copy,
  AlertCircle,
  Briefcase,
  } from "lucide-react";
import {
  CURRENT_USER,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  MOCK_ERP_RECORDS,
  MOCK_USERS,
} from "@/features/connect/mock-data";
import type {
  ConnectConversation,
  ConnectMessage,
  ConnectUser,
  ErpRecordCard,
  MessageDeliveryStatus,
} from "@/features/connect/types";

export default function BrgConnectChatPage() {
  const [conversations, setConversations] = useState<ConnectConversation[]>(INITIAL_CONVERSATIONS);
  const [messagesMap, setMessagesMap] = useState<Record<string, ConnectMessage[]>>(INITIAL_MESSAGES);
  const [activeConvId, setActiveConvId] = useState<string>("conv-farhana");
  const [filterTab, setFilterTab] = useState<"all" | "direct" | "group" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ConnectMessage | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Modals
  const [isErpPickerOpen, setIsErpPickerOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  // Call state
  const [activeCall, setActiveCall] = useState<{
    type: "audio" | "video";
    status: "ringing" | "connected";
    durationSec: number;
    isMuted: boolean;
    isCameraOff: boolean;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Active conversation object
  const activeConv = useMemo(() => {
    return conversations.find((c) => c.id === activeConvId) ?? conversations[0];
  }, [conversations, activeConvId]);

  // Current messages
  const activeMessages = useMemo(() => {
    return messagesMap[activeConvId] ?? [];
  }, [messagesMap, activeConvId]);

  // Direct recipient info (if 1-to-1)
  const directPartner = useMemo(() => {
    if (!activeConv || activeConv.type !== "direct") return null;
    const partnerId = activeConv.members.find((m) => m !== CURRENT_USER.id);
    return MOCK_USERS.find((u) => u.id === partnerId) ?? null;
  }, [activeConv]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeConvId]);

  // Call timer simulation
  useEffect(() => {
    if (!activeCall || activeCall.status !== "connected") return;
    const interval = setInterval(() => {
      setActiveCall((prev) => (prev ? { ...prev, durationSec: prev.durationSec + 1 } : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (filterTab === "direct") return c.type === "direct";
      if (filterTab === "group") return c.type === "group";
      if (filterTab === "unread") return c.unreadCount > 0;
      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  // Mark active conversation read
  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Send message
  const handleSendMessage = () => {
    if (!messageText.trim() && !replyingTo) return;
    const clientMsgId = "c-" + Date.now();
    const newMsg: ConnectMessage = {
      id: "m-" + Date.now(),
      conversationId: activeConvId,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      senderAvatar: CURRENT_USER.avatar,
      clientMsgId,
      type: "text",
      body: messageText.trim(),
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            body: replyingTo.body.slice(0, 70),
          }
        : undefined,
      status: "sending",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessageText("");
    setReplyingTo(null);

    // Optimistic UI append
    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));

    // Simulate Step 2: Server Ack (Sent ✓)
    setTimeout(() => {
      updateMessageStatus(newMsg.id, "sent");
    }, 400);

    // Simulate Step 3: Delivered (✓✓)
    setTimeout(() => {
      updateMessageStatus(newMsg.id, "delivered");
    }, 1100);

    // Simulate Step 4: Seen (✓✓ Blue)
    setTimeout(() => {
      updateMessageStatus(newMsg.id, "seen");
    }, 2400);

    // Simulate Partner Typing and Reply if 1-to-1
    if (activeConv.type === "direct" && directPartner) {
      setTimeout(() => {
        setIsTyping(true);
      }, 3500);

      setTimeout(() => {
        setIsTyping(false);
        const autoReply: ConnectMessage = {
          id: "m-reply-" + Date.now(),
          conversationId: activeConvId,
          senderId: directPartner.id,
          senderName: directPartner.name,
          senderAvatar: directPartner.avatar,
          clientMsgId: "c-reply-" + Date.now(),
          type: "text",
          body: `Noted, Anis Bhai. Ami update ta review kore confirmation janassi.`,
          status: "delivered",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessagesMap((prev) => ({
          ...prev,
          [activeConvId]: [...(prev[activeConvId] || []), autoReply],
        }));
      }, 6200);
    }
  };

  const updateMessageStatus = (msgId: string, status: MessageDeliveryStatus) => {
    setMessagesMap((prev) => {
      const list = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: list.map((m) => (m.id === msgId ? { ...m, status } : m)),
      };
    });
  };

  // Share ERP Card
  const handleShareErpCard = (card: ErpRecordCard) => {
    const newMsg: ConnectMessage = {
      id: "m-" + Date.now(),
      conversationId: activeConvId,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      senderAvatar: CURRENT_USER.avatar,
      clientMsgId: "c-erp-" + Date.now(),
      type: "erp_card",
      body: `Shared ERP record for team collaboration:`,
      erpRecord: card,
      status: "delivered",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));
    setIsErpPickerOpen(false);
  };

  // Handle Edit Message
  const handleSaveEdit = (msgId: string) => {
    if (!editText.trim()) return;
    setMessagesMap((prev) => {
      const list = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: list.map((m) =>
          m.id === msgId
            ? { ...m, body: editText.trim(), editedAt: new Date().toLocaleTimeString() }
            : m
        ),
      };
    });
    setEditingMessageId(null);
    setEditText("");
  };

  // Handle Delete Message
  const handleDeleteMessage = (msgId: string) => {
    if (confirm("Delete this message for everyone?")) {
      setMessagesMap((prev) => {
        const list = prev[activeConvId] || [];
        return {
          ...prev,
          [activeConvId]: list.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  body: "This message was deleted",
                  deletedAt: new Date().toLocaleTimeString(),
                  erpRecord: undefined,
                  attachments: undefined,
                }
              : m
          ),
        };
      });
    }
  };

  // Start Call
  const handleStartCall = (type: "audio" | "video") => {
    setActiveCall({
      type,
      status: "ringing",
      durationSec: 0,
      isMuted: false,
      isCameraOff: false,
    });
    // Simulate answer after 2.5s
    setTimeout(() => {
      setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
    }, 2500);
  };

  const handleEndCall = () => {
    if (!activeCall) return;
    // Log call message
    const duration = activeCall.durationSec;
    const callMsg: ConnectMessage = {
      id: "m-call-" + Date.now(),
      conversationId: activeConvId,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      clientMsgId: "c-call-" + Date.now(),
      type: "call",
      body: activeCall.type === "audio" ? "Audio Call" : "Video Call",
      callInfo: {
        type: activeCall.type,
        status: duration > 0 ? "completed" : "missed",
        durationSec: duration,
      },
      status: "seen",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), callMsg],
    }));
    setActiveCall(null);
  };

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-surface text-ink antialiased">
      {/* Top Banner Navigation Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs">
              BC
            </span>
            <span className="font-semibold text-ink text-sm">BRG Connect</span>
          </div>
          <span className="text-xs text-ink-muted">|</span>
          <nav className="flex items-center gap-1 text-xs">
            <Link
              href="/connect"
              className="rounded px-2.5 py-1 font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40"
            >
              Chat &amp; Channels
            </Link>
            <Link
              href="/connect/directory"
              className="rounded px-2.5 py-1 text-ink-muted hover:bg-control hover:text-ink transition"
            >
              Employee Directory
            </Link>
            <Link
              href="/connect/calls"
              className="rounded px-2.5 py-1 text-ink-muted hover:bg-control hover:text-ink transition"
            >
              Calls &amp; Meetings
            </Link>
            <Link
              href="/connect/docs"
              className="rounded px-2.5 py-1 text-ink-muted hover:bg-control hover:text-ink transition"
            >
              Architecture &amp; Spec
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 font-medium">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>WebSocket Connected</span>
          </div>
          <span className="text-ink-muted">Signed in as <strong>{CURRENT_USER.name}</strong></span>
        </div>
      </div>

      {/* Main 3-Pane Chat Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Conversations & Channels */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-line bg-surface">
          {/* Header & Quick Action Buttons */}
          <div className="p-3 border-b border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Conversations</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(true)}
                  className="size-7 rounded hover:bg-control flex items-center justify-center text-ink-muted hover:text-ink transition cursor-pointer"
                  title="New Direct Message"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewGroupOpen(true)}
                  className="size-7 rounded hover:bg-control flex items-center justify-center text-ink-muted hover:text-ink transition cursor-pointer"
                  title="Create Channel / Group"
                >
                  <Users className="size-4" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats, employees..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded border border-line bg-control/40 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-ink-muted hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 border-b border-line/60 pb-1 text-[11px] font-medium">
              {(["all", "direct", "group", "unread"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`px-2 py-0.5 rounded capitalize transition ${
                    filterTab === tab
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-ink-muted hover:bg-control hover:text-ink"
                  }`}
                >
                  {tab === "direct" ? "DMs" : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-line/40">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-muted">
                No matching conversations found.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConvId;
                const isGroup = c.type === "group";
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConv(c.id)}
                    className={`flex items-start gap-3 p-3 transition cursor-pointer ${
                      isActive ? "bg-accent-soft/80 border-l-3 border-blue-600" : "hover:bg-control/50"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs">
                          <Hash className="size-4" />
                        </div>
                      ) : (
                        <>
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="size-9 rounded-full object-cover border border-line"
                          />
                          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                        </>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${isActive ? "font-bold text-ink" : "font-medium text-ink"}`}>
                          {c.name}
                        </span>
                        <span className="text-[10px] text-ink-muted shrink-0 ml-1">
                          {c.lastMessage?.createdAt || ""}
                        </span>
                      </div>

                      <p className="text-[11px] text-ink-muted truncate mt-0.5">
                        {c.lastMessage?.body || c.description}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        {c.isPinned && <Pin className="size-2.5 text-blue-600 rotate-45" />}
                        {c.isMuted && <BellOff className="size-2.5 text-ink-muted" />}
                        {c.unreadCount > 0 && (
                          <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center: Active Chat Stream */}
        <main className="flex flex-1 flex-col overflow-hidden bg-surface">
          {/* Active Conversation Top Bar */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              {activeConv.type === "group" ? (
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-sm">
                  <Hash className="size-4" />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={activeConv.avatar}
                    alt={activeConv.name}
                    className="size-9 rounded-full object-cover border border-line"
                  />
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink truncate">{activeConv.name}</h3>
                  {activeConv.isMuted && <BellOff className="size-3 text-ink-muted" />}
                </div>
                <span className="text-[11px] text-ink-muted block truncate">
                  {activeConv.type === "group"
                    ? `${activeConv.members.length} members • ${activeConv.description}`
                    : directPartner
                    ? `${directPartner.designation} • ${directPartner.department}`
                    : "Online"}
                </span>
              </div>
            </div>

            {/* Action Bar (Audio/Video Call, Details Drawer Toggle) */}
            <div className="flex items-center gap-1 text-ink-muted">
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                className="size-8 rounded hover:bg-control flex items-center justify-center hover:text-ink transition cursor-pointer"
                title="Start 1-to-1 WebRTC Audio Call"
              >
                <Phone className="size-4 text-emerald-600" />
              </button>
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                className="size-8 rounded hover:bg-control flex items-center justify-center hover:text-ink transition cursor-pointer"
                title="Start 1-to-1 WebRTC Video Call"
              >
                <Video className="size-4 text-blue-600" />
              </button>
              <span className="h-4 w-px bg-line mx-1" />
              <button
                type="button"
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                  isDetailsOpen ? "bg-control text-ink" : "hover:bg-control hover:text-ink"
                }`}
                title="Conversation Info"
              >
                <Info className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-control/20">
            {/* System Info Notice */}
            <div className="flex justify-center my-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-line bg-surface text-[11px] text-ink-muted shadow-2xs">
                <AlertCircle className="size-3 text-blue-500" />
                <span>Messages in BridgeOne Connect are TLS encrypted at rest and in transit.</span>
              </div>
            </div>

            {activeMessages.map((msg) => {
              const isMe = msg.senderId === CURRENT_USER.id;
              const isSystem = msg.type === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="text-[11px] italic text-ink-muted bg-surface/80 px-3 py-1 rounded-full border border-line">
                      {msg.body}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isMe && (
                    <img
                      src={msg.senderAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80"}
                      alt={msg.senderName}
                      className="size-7 rounded-full object-cover shrink-0 mt-0.5 border border-line"
                    />
                  )}

                  <div className={`max-w-[70%] space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && activeConv.type === "group" && (
                      <span className="text-[11px] font-bold text-ink-muted block pl-1">
                        {msg.senderName}
                      </span>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`relative rounded-xl p-3 text-xs leading-relaxed shadow-2xs ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-xs"
                          : "bg-surface border border-line text-ink rounded-tl-xs"
                      }`}
                    >
                      {/* Quoted Reply Preview */}
                      {msg.replyTo && (
                        <div
                          className={`mb-2 p-2 rounded text-[11px] border-l-2 ${
                            isMe
                              ? "bg-blue-700/60 border-white/60 text-white/90"
                              : "bg-control/60 border-blue-500 text-ink-muted"
                          }`}
                        >
                          <span className="font-semibold block">{msg.replyTo.senderName}</span>
                          <span className="truncate block opacity-85">{msg.replyTo.body}</span>
                        </div>
                      )}

                      {/* Editing View or Normal Text */}
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full h-16 p-2 rounded bg-surface text-ink text-xs border border-line focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setEditingMessageId(null)}
                              className="px-2 py-0.5 rounded bg-control text-ink text-[11px]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(msg.id)}
                              className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                      )}

                      {/* Embedded ERP Record Card */}
                      {msg.erpRecord && (
                        <div
                          className={`mt-2.5 p-3 rounded-lg border shadow-xs ${
                            isMe
                              ? "bg-blue-700/80 border-blue-500/50 text-white"
                              : "bg-control/40 border-line text-ink"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Briefcase className="size-3.5 text-amber-400" />
                              <span className="font-mono font-bold text-[11px] tracking-wide">
                                {msg.erpRecord.code}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface/20">
                              {msg.erpRecord.status}
                            </span>
                          </div>

                          <div className="font-medium text-xs mb-1">{msg.erpRecord.title}</div>
                          {msg.erpRecord.subtitle && (
                            <div className="text-[11px] opacity-85">{msg.erpRecord.subtitle}</div>
                          )}
                          {msg.erpRecord.amount && (
                            <div className="font-mono font-bold text-xs mt-1 text-emerald-300">
                              {msg.erpRecord.amount}
                            </div>
                          )}

                          <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between">
                            <span className="text-[10px] opacity-75">BridgeOne ERP Live Link</span>
                            <Link
                              href={msg.erpRecord.link}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 hover:opacity-85"
                            >
                              <span>Open Record</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {msg.attachments?.map((att) => (
                        <div
                          key={att.id}
                          className={`mt-2 flex items-center gap-2.5 p-2 rounded border ${
                            isMe
                              ? "bg-blue-700/50 border-white/30 text-white"
                              : "bg-control/40 border-line text-ink"
                          }`}
                        >
                          <FileText className="size-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="block truncate font-medium text-[11px]">{att.name}</span>
                            <span className="text-[10px] opacity-75">
                              {(att.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => alert(`Downloading ${att.name}...`)}
                            className="size-6 rounded hover:bg-surface/20 flex items-center justify-center transition"
                            title="Download attachment"
                          >
                            <Download className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Call Log Info */}
                      {msg.callInfo && (
                        <div className="flex items-center gap-2 text-xs font-medium mt-1">
                          <PhoneCall className="size-3.5 text-emerald-400" />
                          <span>
                            {msg.callInfo.status === "completed"
                              ? `Call ended (${formatTime(msg.callInfo.durationSec || 0)})`
                              : "Missed Call"}
                          </span>
                        </div>
                      )}

                      {/* Timestamp & Status Delivery Ticks */}
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                          isMe ? "text-blue-100" : "text-ink-muted"
                        }`}
                      >
                        {msg.editedAt && <span>(edited)</span>}
                        <span>{msg.createdAt}</span>

                        {isMe && (
                          <span title={`Status: ${msg.status}`}>
                            {msg.status === "sending" && <Clock className="size-3 text-blue-200 animate-spin" />}
                            {msg.status === "sent" && <Check className="size-3 text-blue-200" />}
                            {msg.status === "delivered" && <CheckCheck className="size-3 text-blue-200" />}
                            {msg.status === "seen" && <CheckCheck className="size-3 text-sky-300 font-bold" />}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Hover Message Actions Menu */}
                    <div
                      className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition px-1 ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setReplyingTo(msg)}
                        className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink"
                        title="Reply"
                      >
                        <Reply className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(msg.body)}
                        className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink"
                        title="Copy text"
                      >
                        <Copy className="size-3" />
                      </button>
                      {isMe && !msg.deletedAt && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditText(msg.body);
                            }}
                            className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink"
                            title="Edit message"
                          >
                            <Edit2 className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 rounded hover:bg-control text-rose-500 hover:text-rose-700"
                            title="Delete message"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-ink-muted italic">
                <span className="flex gap-1 items-center">
                  <span className="size-1.5 rounded-full bg-blue-600 animate-bounce" />
                  <span className="size-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                  <span className="size-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                </span>
                <span>{directPartner?.name || "Member"} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Reply Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between bg-control/60 border-t border-line px-4 py-1.5 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Reply className="size-3.5 text-blue-600 shrink-0" />
                <span className="text-ink-muted">Replying to <strong>{replyingTo.senderName}</strong>:</span>
                <span className="text-ink truncate font-medium">{replyingTo.body}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Bottom Message Composer */}
          <div className="p-3 border-t border-line bg-surface">
            <div className="flex items-end gap-2 rounded-lg border border-line bg-surface p-1.5 shadow-2xs focus-within:ring-1 focus-within:ring-blue-500">
              {/* Attachment Triggers */}
              <div className="flex items-center gap-1 text-ink-muted pb-1">
                <button
                  type="button"
                  onClick={() => alert("File upload modal: select PDF, DOCX, XLSX, or images (25 MB max)")}
                  className="size-7 rounded hover:bg-control flex items-center justify-center hover:text-ink transition cursor-pointer"
                  title="Attach File or Document"
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsErpPickerOpen(true)}
                  className="size-7 rounded hover:bg-control flex items-center justify-center text-blue-600 hover:text-blue-700 transition cursor-pointer"
                  title="Attach ERP Record Card (PO, Requisition, Invoice)"
                >
                  <Share2 className="size-4" />
                </button>
              </div>

              {/* Text Area */}
              <textarea
                ref={chatInputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                className="flex-1 max-h-32 min-h-8 resize-none bg-transparent py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none"
              />

              {/* Voice & Send Buttons */}
              <div className="flex items-center gap-1 pb-1">
                <button
                  type="button"
                  onClick={() => alert("Voice message push-to-talk recording triggered")}
                  className="size-7 rounded hover:bg-control flex items-center justify-center text-ink-muted hover:text-ink transition cursor-pointer"
                  title="Voice Message"
                >
                  <Mic className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() && !replyingTo}
                  className="size-8 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center transition cursor-pointer shadow-xs"
                  title="Send Message"
                >
                  <Send className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Pane: Conversation Details / Member Drawer */}
        {isDetailsOpen && (
          <aside className="w-72 shrink-0 border-l border-line bg-surface p-4 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Details</h3>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Profile or Group Info Card */}
            <div className="text-center space-y-2">
              {activeConv.type === "group" ? (
                <div className="flex size-14 mx-auto items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xl">
                  <Hash className="size-7" />
                </div>
              ) : (
                <img
                  src={activeConv.avatar}
                  alt={activeConv.name}
                  className="size-14 mx-auto rounded-full object-cover border-2 border-line"
                />
              )}
              <h4 className="font-bold text-sm text-ink">{activeConv.name}</h4>
              <p className="text-xs text-ink-muted">{activeConv.description}</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                className="flex items-center justify-center gap-1.5 p-2 rounded border border-line bg-control/40 hover:bg-control text-ink transition"
              >
                <Phone className="size-3.5 text-emerald-600" />
                <span>Audio Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                className="flex items-center justify-center gap-1.5 p-2 rounded border border-line bg-control/40 hover:bg-control text-ink transition"
              >
                <Video className="size-3.5 text-blue-600" />
                <span>Video Call</span>
              </button>
            </div>

            {/* Members Section (If Group) */}
            {activeConv.type === "group" && (
              <div className="space-y-2 pt-2 border-t border-line">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>Channel Members ({activeConv.members.length})</span>
                </div>
                <div className="space-y-1.5">
                  {MOCK_USERS.filter((u) => activeConv.members.includes(u.id)).map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-control/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={member.avatar} alt={member.name} className="size-6 rounded-full object-cover" />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-ink">{member.name}</span>
                          <span className="text-[10px] text-ink-muted truncate block">{member.department}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-ink-muted px-1.5 py-0.5 rounded bg-control">
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy & Notification Settings */}
            <div className="space-y-2 pt-2 border-t border-line text-xs">
              <button
                type="button"
                onClick={() => {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConvId ? { ...c, isMuted: !c.isMuted } : c
                    )
                  );
                }}
                className="w-full flex items-center justify-between p-2 rounded border border-line bg-control/30 text-ink hover:bg-control transition"
              >
                <span>Mute Notifications</span>
                {activeConv.isMuted ? <BellOff className="size-3.5 text-amber-500" /> : <Bell className="size-3.5" />}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* WebRTC Live Call Modal */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-white text-center shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="relative size-24 mx-auto">
                <img
                  src={activeConv.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"}
                  alt={activeConv.name}
                  className="size-24 rounded-full object-cover border-4 border-slate-700"
                />
                {activeCall.status === "ringing" && (
                  <span className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-60" />
                )}
              </div>
              <h3 className="font-bold text-lg">{activeConv.name}</h3>
              <p className="text-xs text-slate-400">
                {activeCall.status === "ringing"
                  ? "Ringing WebRTC Peer (Coturn TURN/STUN active)..."
                  : `Connected • ${formatTime(activeCall.durationSec)}`}
              </p>
            </div>

            {/* Video Placeholder (if video call) */}
            {activeCall.type === "video" && (
              <div className="relative h-44 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden">
                <span className="text-xs text-slate-400">
                  {activeCall.isCameraOff ? "Camera is off" : "WebRTC Video Stream Active"}
                </span>
                <div className="absolute bottom-2 right-2 size-14 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center text-[10px] text-slate-300">
                  Self View
                </div>
              </div>
            )}

            {/* Audio Waves Simulation */}
            {activeCall.type === "audio" && activeCall.status === "connected" && (
              <div className="flex items-center justify-center gap-1.5 h-12">
                {[40, 75, 50, 90, 60, 30, 80, 55].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="w-1.5 rounded-full bg-emerald-400 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))
                }
                className={`size-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                  activeCall.isMuted ? "bg-rose-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
                title={activeCall.isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {activeCall.isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>

              {activeCall.type === "video" && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveCall((prev) =>
                      prev ? { ...prev, isCameraOff: !prev.isCameraOff } : null
                    )
                  }
                  className={`size-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                    activeCall.isCameraOff
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                  title={activeCall.isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
                >
                  {activeCall.isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>
              )}

              <button
                type="button"
                onClick={handleEndCall}
                className="size-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition cursor-pointer shadow-lg"
                title="Hang Up"
              >
                <PhoneOff className="size-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share ERP Record Modal */}
      {isErpPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-blue-600" />
                <h3 className="font-bold text-sm">Attach ERP Record to Chat</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsErpPickerOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted">
              Select an active Purchase Order, Requisition, Sales Invoice or Inventory Item to share as an interactive card.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {MOCK_ERP_RECORDS.map((card) => (
                <div
                  key={card.id}
                  onClick={() => handleShareErpCard(card)}
                  className="flex items-center justify-between p-3 rounded-lg border border-line bg-control/30 hover:bg-control/80 transition cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-blue-600">{card.code}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface border border-line uppercase">
                        {card.status}
                      </span>
                    </div>
                    <span className="block font-medium text-xs text-ink truncate">{card.title}</span>
                    {card.subtitle && <span className="block text-[11px] text-ink-muted">{card.subtitle}</span>}
                  </div>
                  {card.amount && (
                    <span className="font-mono font-bold text-xs text-emerald-600 shrink-0 ml-2">
                      {card.amount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Direct Chat Modal */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-bold text-sm">Start New Direct Message</h3>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted">Select an employee from the ERP directory to start a chat:</p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {MOCK_USERS.filter((u) => u.id !== CURRENT_USER.id).map((user) => (
                <div
                  key={user.id}
                  onClick={() => {
                    // Check if exists
                    const existing = conversations.find(
                      (c) => c.type === "direct" && c.members.includes(user.id)
                    );
                    if (existing) {
                      setActiveConvId(existing.id);
                    } else {
                      const newConvId = "conv-" + user.id;
                      const newC: ConnectConversation = {
                        id: newConvId,
                        type: "direct",
                        name: user.name,
                        avatar: user.avatar,
                        description: `${user.designation} • ${user.department}`,
                        department: user.department,
                        members: [CURRENT_USER.id, user.id],
                        unreadCount: 0,
                        createdAt: new Date().toISOString(),
                      };
                      setConversations((prev) => [newC, ...prev]);
                      setActiveConvId(newConvId);
                    }
                    setIsNewChatOpen(false);
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-line bg-control/20 hover:bg-control transition cursor-pointer"
                >
                  <img src={user.avatar} alt={user.name} className="size-9 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <span className="block font-medium text-xs text-ink truncate">{user.name}</span>
                    <span className="text-[11px] text-ink-muted truncate block">
                      {user.designation} • {user.department}
                    </span>
                  </div>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Group / Channel Modal */}
      {isNewGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-bold text-sm">Create New Team Channel</h3>
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-ink-muted mb-1">Channel Name *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-ink-muted">#</span>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. accounts-audit"
                    className="w-full h-8 pl-6 pr-3 rounded border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">Description / Topic</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Purpose of this channel"
                  className="w-full h-8 px-2.5 rounded border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">Select Members</label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded p-2 bg-control/20">
                  {MOCK_USERS.filter((u) => u.id !== CURRENT_USER.id).map((u) => {
                    const isSelected = selectedGroupMembers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedGroupMembers((prev) =>
                            isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          );
                        }}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold" : "hover:bg-control"
                        }`}
                      >
                        <span>{u.name} ({u.department})</span>
                        {isSelected && <Check className="size-3.5 text-blue-600" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsNewGroupOpen(false)}
                className="px-3 py-1.5 rounded border border-line text-xs text-ink hover:bg-control"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newGroupName.trim()}
                onClick={() => {
                  const channelName = newGroupName.startsWith("#") ? newGroupName : `#${newGroupName}`;
                  const newChannelId = "conv-grp-" + Date.now();
                  const newC: ConnectConversation = {
                    id: newChannelId,
                    type: "group",
                    name: channelName,
                    description: newGroupDesc || "General Team Channel",
                    members: [CURRENT_USER.id, ...selectedGroupMembers],
                    unreadCount: 0,
                    createdAt: new Date().toISOString(),
                  };
                  setConversations((prev) => [newC, ...prev]);
                  setActiveConvId(newChannelId);
                  setIsNewGroupOpen(false);
                  setNewGroupName("");
                  setNewGroupDesc("");
                  setSelectedGroupMembers([]);
                }}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
