"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session";
import { getPusherClient } from "@/lib/connect/pusher-client";
import { playMessageChime, startIncomingRingtone, stopRingtone } from "@/lib/connect/webrtc";
import {
  Phone,
  PhoneOff,
  Video,
  MessageCircle,
  MessageSquare,
  Send,
  X,
  ExternalLink,
  Bell,
  Loader2,
  Minus,
  Paperclip,
  ChevronLeft,
  Search,
  CheckCheck,
  FileText,
  SquarePen,
  UserPlus,
} from "lucide-react";
import { NewChatPanel } from "./new-chat-panel";
import { formatDate } from "@/lib/format";

interface ExtendedNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  requireInteraction?: boolean;
}

interface IncomingCallData {
  conversationId: string;
  callerId: string;
  callerName: string;
  callType: "audio" | "video";
  timestamp: number;
}

interface WhatsAppConversation {
  id: string;
  name: string;
  type: string;
  unreadCount?: number;
  lastMessage?: {
    id: string;
    body: string;
    createdAt?: string;
  };
}

interface WhatsAppChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  type?: string;
  deletedAt?: string | null;
  createdAt: string;
  rawDate?: string;
  status?: "sent" | "delivered" | "read";
  attachments?: { url: string; name: string; size?: number; mimeType?: string }[];
}

function getMessageDateLabel(dateStr?: string): string {
  if (!dateStr) return "Today";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Today";
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${formatDate(d)}`;
  } catch {
    return "Today";
  }
}

export function ConnectGlobalNotifier() {
  const { user: authUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Incoming Call Overlay state
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const incomingCallRef = useRef<IncomingCallData | null>(null);

  // Desktop Notification permission banner
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [hidePermissionBanner, setHidePermissionBanner] = useState(false);

  // WhatsApp Floating Messenger State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [viewMode, setViewMode] = useState<"chat" | "conversations" | "new-chat">("conversations");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConvName, setActiveConvName] = useState<string>("BRG Connect");
  const activeConvIdRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [messages, setMessages] = useState<WhatsAppChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pathnameRef = useRef(pathname);
  const conversationsRef = useRef<WhatsAppConversation[]>([]);
  const messagesRequestRef = useRef(0);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Group chats must show the group's name, not the last sender's.
  const conversationName = (convId: string, fallback?: string) =>
    conversationsRef.current.find((c) => c.id === convId)?.name || fallback || "Colleague";

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen && !isMinimized && viewMode === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, viewMode]);

  // Request browser Notification permission
  const requestDesktopPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("This browser does not support desktop notifications.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        try {
          const testNotif = new Notification("BRG Connect Desktop Notifications", {
            body: "Desktop notifications are now enabled! You will receive instant call and message alerts in the corner of your screen.",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "brg-welcome",
          });
          setTimeout(() => testNotif.close(), 5000);
        } catch {}
      }
    } catch (e) {
      console.warn("Notification permission request error:", e);
    }
  };

  // Load all recent conversations
  const loadConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const res = await fetch("/api/connect/conversations");
      const data = await res.json();
      if (data?.success && Array.isArray(data.conversations)) {
        const mapped: WhatsAppConversation[] = data.conversations.map((c: {
          id: string;
          name: string;
          type: string;
          unreadCount?: number;
          lastMessage?: { id: string; body: string; createdAt?: string };
        }) => ({
          id: c.id,
          name: c.name || "Conversation",
          type: c.type,
          unreadCount: c.unreadCount || 0,
          lastMessage: c.lastMessage,
        }));
        setConversations(mapped);
        const total = mapped.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadTotal(total);
      }
    } catch (err) {
      console.warn("Failed to load conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Load messages for a specific conversation
  const loadMessages = async (convId: string) => {
    if (!convId) return;
    // Switching chats quickly must not let an older response overwrite the newer chat.
    const requestId = ++messagesRequestRef.current;
    setIsLoadingMessages(true);
    try {
      // Clear unread in backend
      fetch(`/api/connect/conversations/${convId}/read`, { method: "POST" }).catch(() => {});

      const res = await fetch(`/api/connect/conversations/${convId}/messages`);
      const data = await res.json();
      if (requestId !== messagesRequestRef.current) return;
      if (data?.success && Array.isArray(data.messages)) {
        setMessages(
          data.messages.slice(-40).map((m: {
            id: string;
            senderId: string;
            senderName: string;
            body: string;
            type?: string;
            deletedAt?: string | null;
            createdAt?: string;
            attachments?: { url: string; name: string; size?: number; mimeType?: string }[];
          }) => {
            let bodyText = m.body;
            if (m.deletedAt) {
              bodyText = "This message was deleted";
            } else if (!bodyText) {
              if (m.type === "FILE") bodyText = "📎 Sent a file attachment";
              else if (m.type === "ERP_CARD") bodyText = "📋 Shared live ERP record";
              else if (m.type === "CALL_LOG") bodyText = "📞 Voice call - Accepted on another device";
            }

            let formattedTime = "";
            if (m.createdAt) {
              try {
                formattedTime = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              } catch {}
            }

            return {
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName,
              body: bodyText,
              type: m.type,
              deletedAt: m.deletedAt,
              createdAt: formattedTime,
              rawDate: m.createdAt,
              status: "read" as const,
              attachments: m.attachments,
            };
          })
        );
      }
    } catch (err) {
      console.warn("Failed to load conversation messages:", err);
    } finally {
      if (requestId === messagesRequestRef.current) setIsLoadingMessages(false);
    }
  };

  // Open specific conversation in chat view
  const openConversation = (convId: string, convName: string) => {
    setActiveConvId(convId);
    setActiveConvName(convName);
    setViewMode("chat");
    setIsOpen(true);
    setIsMinimized(false);
    loadMessages(convId);
  };

  // Initial load
  useEffect(() => {
    if (authUser?.id && pathname !== "/connect") {
      queueMicrotask(() => {
        loadConversations();
      });
    }
  }, [authUser?.id, pathname]);

  // Pusher Global Events.
  // Subscribed once per user (not per navigation) so a ringing call survives page changes.
  // The /connect page shares this channel, so each side unbinds only its own handlers.
  useEffect(() => {
    if (!authUser?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe("connect-global");

    // 1. Call signal event
    const onCallSignal = (signal: {
        conversationId: string;
        senderId: string;
        senderName: string;
        type: string;
        callType: "audio" | "video";
      }) => {
        if (String(signal.senderId).toLowerCase() === String(authUser.id).toLowerCase()) return;

        if (signal.type === "call-request") {
          const isTabHidden = typeof document !== "undefined" && document.hidden;
          const isDifferentPage = pathnameRef.current !== "/connect";

          const callData: IncomingCallData = {
            conversationId: signal.conversationId,
            callerId: signal.senderId,
            callerName: signal.senderName || "Colleague",
            callType: signal.callType || "audio",
            timestamp: Date.now(),
          };

          if (isDifferentPage) {
            setIncomingCall(callData);
            startIncomingRingtone();
          }

          if ((isTabHidden || isDifferentPage) && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                const callOptions: ExtendedNotificationOptions = {
                  body: `${signal.callType === "video" ? "📹 Incoming Video Call" : "🎙️ Incoming Voice Call"} on BRG Connect. Click to answer.`,
                  icon: "/favicon.ico",
                  badge: "/favicon.ico",
                  tag: `call-${signal.conversationId}`,
                  renotify: true,
                  requireInteraction: true,
                };
                const notif = new Notification(
                  `📞 Incoming Call: ${signal.senderName || "Colleague"}`,
                  callOptions
                );
                notif.onclick = () => {
                  window.focus();
                  stopRingtone();
                  setIncomingCall(null);
                  router.push(`/connect?conversationId=${signal.conversationId}&autoAccept=true&callType=${signal.callType || "audio"}`);
                };
              } catch (e) {
                console.warn("[WebRTC] Native desktop call notification error:", e);
              }
            }
          }
        }

        if (signal.type === "call-reject" || signal.type === "call-hangup") {
          if (incomingCallRef.current?.conversationId === signal.conversationId) {
            stopRingtone();
            setIncomingCall(null);
          }
        }
      };
    channel.bind("call-signal", onCallSignal);

    // 2. Incoming message event
    const onNewMessage = (msg: {
        id: string;
        conversationId: string;
        senderId: string;
        senderName: string;
        body?: string;
        type?: string;
        attachments?: { url: string; name: string; size?: number; mimeType?: string }[];
      }) => {
        if (String(msg.senderId).toLowerCase() === String(authUser.id).toLowerCase()) return;

        const isTabHidden = typeof document !== "undefined" && document.hidden;
        const isDifferentPage = pathnameRef.current !== "/connect";
        const convName = conversationName(msg.conversationId, msg.senderName);

        let previewText = msg.body?.trim() || "";
        const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
        if (!previewText && hasAttachments) {
          previewText = "Sent a file attachment";
        } else if (msg.type === "erp_card" || msg.type === "ERP_CARD") {
          previewText = "Shared a live ERP document card";
        }

        // Play chime sound
        playMessageChime();

        // If on another page (/purchase, /account, /inventory, etc.), auto-hover the WhatsApp messenger!
        if (isDifferentPage) {
          setIsOpen(true);
          setIsMinimized(false);
          setActiveConvId(msg.conversationId);
          setActiveConvName(convName);
          setViewMode("chat");

          // If currently viewing this conversation, append seamlessly; otherwise load full messages
          if (activeConvIdRef.current === msg.conversationId) {
            setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [
              ...prev,
              {
                id: msg.id || `m-new-${Date.now()}`,
                senderId: msg.senderId,
                senderName: msg.senderName,
                body: previewText,
                type: msg.type,
                createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                rawDate: new Date().toISOString(),
                status: "delivered",
                attachments: msg.attachments,
              },
            ]);
          } else {
            loadMessages(msg.conversationId);
          }

          // Mark as read in DB
          fetch(`/api/connect/conversations/${msg.conversationId}/read`, { method: "POST" }).catch(() => {});
          loadConversations();
        }

        // Desktop corner notification
        if ((isTabHidden || isDifferentPage) && typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            try {
              const msgOptions: ExtendedNotificationOptions = {
                body: previewText || "You have a new message",
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: `msg-${msg.conversationId}`,
                renotify: true,
              };
              const notif = new Notification(msg.senderName || "BRG Connect", msgOptions);
              notif.onclick = () => {
                window.focus();
                if (pathnameRef.current === "/connect") {
                  router.push(`/connect?conversationId=${msg.conversationId}`);
                  return;
                }
                setIsOpen(true);
                setIsMinimized(false);
                setActiveConvId(msg.conversationId);
                setActiveConvName(convName);
                setViewMode("chat");
                loadMessages(msg.conversationId);
              };
            } catch (e) {
              console.warn("[WebRTC] Native desktop notification error:", e);
            }
          }
        }
      };
    channel.bind("new-message", onNewMessage);

    // 3. Live Seen Receipts
    const onMessagesSeen = (data: { conversationId: string; readerId: string }) => {
      if (
        String(data.readerId).toLowerCase() !== String(authUser.id).toLowerCase() &&
        activeConvIdRef.current === data.conversationId
      ) {
        setMessages((prev) => prev.map((m) => ({ ...m, status: "read" })));
      }
    };
    channel.bind("messages-seen", onMessagesSeen);

    return () => {
      // Unbind only our handlers; unbind_all/unsubscribe would also kill the /connect page's listeners.
      channel.unbind("call-signal", onCallSignal);
      channel.unbind("new-message", onNewMessage);
      channel.unbind("messages-seen", onMessagesSeen);
      stopRingtone();
    };
  }, [authUser?.id, router]);

  // Handle Call Accept & Decline
  const handleAcceptCall = () => {
    if (!incomingCall) return;
    const { conversationId, callType } = incomingCall;
    stopRingtone();
    setIncomingCall(null);
    router.push(`/connect?conversationId=${conversationId}&autoAccept=true&callType=${callType || "audio"}`);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    const { conversationId } = incomingCall;
    stopRingtone();
    setIncomingCall(null);
    try {
      await fetch("/api/connect/calls/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          type: "call-reject",
          senderId: authUser?.id,
          senderName: authUser?.name,
        }),
      });
    } catch {}
  };

  // Start outgoing call from WhatsApp header
  const handleStartCall = (type: "audio" | "video") => {
    if (!activeConvId) return;
    router.push(`/connect?conversationId=${activeConvId}&startCall=true&callType=${type}`);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeConvId || isSending) return;

    const optimisticMsg: WhatsAppChatMessage = {
      id: `m-opt-${Date.now()}`,
      senderId: authUser?.id || "user-current",
      senderName: authUser?.name || "Me",
      body: text,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      rawDate: new Date().toISOString(),
      status: "sent",
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const res = await fetch(`/api/connect/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientMsgId: `c-${Date.now()}`,
          type: "TEXT",
          bodyText: text,
          senderId: authUser?.id || "user-current",
          senderName: authUser?.name || "Me",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? { ...m, status: "delivered" } : m))
      );
    } catch (err) {
      console.warn("Failed to send message:", err);
      // Don't leave a phantom "sent" bubble: drop it and give the text back so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText((cur) => cur || text);
    } finally {
      setIsSending(false);
    }
  };

  // File upload from paperclip
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch("/api/connect/upload", {
        method: "POST",
        body: formData,
      });
      const upData = await upRes.json().catch(() => null);
      const att = upRes.ok ? upData?.attachment || upData?.attachments?.[0] : null;
      if (!att?.url) throw new Error(upData?.error || `Upload failed (HTTP ${upRes.status})`);
      const sendRes = await fetch(`/api/connect/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientMsgId: `c-file-${Date.now()}`,
          type: "FILE",
          bodyText: file.name,
          senderId: authUser?.id || "user-current",
          senderName: authUser?.name || "Me",
          attachments: [
            {
              url: att.url,
              name: file.name,
              size: file.size,
              mimeType: file.type,
            },
          ],
        }),
      });
      if (!sendRes.ok) throw new Error(`Sending file message failed (HTTP ${sendRes.status})`);
      loadMessages(activeConvId);
    } catch (err) {
      console.warn("File upload failed:", err);
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // If already on /connect, do not show duplicate hover window
  if (pathname === "/connect") {
    return null;
  }

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(convSearch.toLowerCase())
  );

  return (
    <>
      {/* 1. Desktop Notification Permission Banner in Corner */}
      {notificationPermission === "default" && !hidePermissionBanner && (
        <div className="fixed inset-x-2 top-16 z-[99998] max-w-sm sm:left-auto sm:right-5 sm:w-full rounded-xl border border-blue-500/40 bg-surface dark:bg-slate-900 p-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
            <Bell className="size-4 animate-bounce" />
          </div>
          <div className="flex-1 text-xs space-y-1.5">
            <p className="font-semibold text-ink dark:text-white">Enable Desktop Notifications</p>
            <p className="text-ink-muted text-[11px] leading-relaxed">
              Allow notifications to receive instant call and message popups in the corner of your screen, even when the browser is minimized.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] cursor-pointer transition shadow-xs"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => setHidePermissionBanner(true)}
                className="px-2 py-1 text-ink-muted hover:text-ink text-[11px] cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHidePermissionBanner(true)}
            className="-m-1 size-7 shrink-0 inline-flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer rounded"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 2. Full Incoming Call Alert Modal */}
      {incomingCall && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 text-white p-6 shadow-2xl text-center space-y-6">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
              <span className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg border-2 border-emerald-400">
                {incomingCall.callerName.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-white">{incomingCall.callerName}</h3>
              <p className="text-sm font-medium text-emerald-400 flex items-center justify-center gap-1.5">
                {incomingCall.callType === "video" ? (
                  <>
                    <Video className="size-4 animate-bounce" />
                    <span>Incoming Video Call...</span>
                  </>
                ) : (
                  <>
                    <Phone className="size-4 animate-bounce" />
                    <span>Incoming Voice Call...</span>
                  </>
                )}
              </p>
              <p className="text-xs text-slate-400">BRG Connect Enterprise</p>
            </div>

            <div className="flex items-center justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="size-14 rounded-full bg-rose-600 group-hover:bg-rose-500 flex items-center justify-center shadow-lg transition-transform active:scale-95 text-white">
                  <PhoneOff className="size-6" />
                </div>
                <span className="text-xs font-semibold text-rose-300">Decline</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                <div className="size-14 rounded-full bg-emerald-600 group-hover:bg-emerald-500 flex items-center justify-center shadow-lg transition-transform active:scale-95 text-white animate-bounce">
                  <Phone className="size-6" />
                </div>
                <span className="text-xs font-semibold text-emerald-300">Answer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Floating WhatsApp Launcher (FAB) in the Screen Corner */}
      {(!isOpen || isMinimized) && (
        <div
          className="fixed bottom-24 right-5 z-[9999] pointer-events-auto transition-all print:hidden"
        >
          <button
            type="button"
            onClick={() => {
              // Always start at the chat list so the user picks who to message,
              // instead of landing in whichever conversation happened to be first/last.
              setIsOpen(true);
              setIsMinimized(false);
              setConvSearch("");
              setViewMode("conversations");
              loadConversations();
            }}
            className="relative size-13 rounded-full bg-[#25d366] hover:bg-[#20ba59] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer group border-2 border-white dark:border-slate-800"
            title="Open BRG Connect (WhatsApp On-Page Chat)"
            aria-label={unreadTotal > 0 ? `Open BRG Connect, ${unreadTotal} unread` : "Open BRG Connect"}
          >
            <MessageCircle className="size-6 text-white" />
            {unreadTotal > 0 && (
              <span className="absolute -top-1 -right-1 size-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center shadow-md animate-pulse">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 4. WhatsApp Hover Messenger (Pinned to the Right of the Screen Over Any Page) */}
      {isOpen && !isMinimized && (
        <div
          className="print:hidden fixed top-3 bottom-3 right-3 z-[99999] w-[370px] sm:w-[410px] max-w-[calc(100vw-24px)] rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800 bg-[#efeae2] dark:bg-[#0b141a] flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-200 pointer-events-auto"
          style={{
            backgroundImage: `radial-gradient(currentColor 0.75px, transparent 0.75px)`,
            backgroundSize: "16px 16px",
          }}
        >
          {/* Top Bar (WhatsApp Style) */}
          <div className="h-14 px-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              {viewMode !== "conversations" && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("conversations");
                    loadConversations();
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="View All Chats"
                  aria-label="Back to all chats"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}

              {/* Avatar */}
              <div className="relative size-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {viewMode === "chat" ? (
                  activeConvName.slice(0, 2).toUpperCase() || "BC"
                ) : viewMode === "new-chat" ? (
                  <UserPlus className="size-4" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                {viewMode === "chat" && (
                  <span className="size-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 absolute -bottom-0.5 -right-0.5" />
                )}
              </div>

              {/* Title & Status */}
              <div className="min-w-0">
                <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                  {viewMode === "chat" ? activeConvName : viewMode === "new-chat" ? "New Chat" : "BRG Connect Chats"}
                </h3>
                {viewMode === "new-chat" ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Select a colleague to message</p>
                ) : (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{viewMode === "chat" ? "Online" : `${conversations.length} Active Chats`}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Header Action Icons */}
            <div className="flex items-center gap-0.5 text-slate-600 dark:text-slate-300">
              {viewMode === "chat" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleStartCall("video")}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 transition cursor-pointer"
                    title="Start Video Call"
                    aria-label="Start video call"
                  >
                    <Video className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCall("audio")}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 transition cursor-pointer"
                    title="Start Voice Call"
                    aria-label="Start voice call"
                  >
                    <Phone className="size-4" />
                  </button>
                </>
              )}

              {viewMode === "conversations" && (
                <button
                  type="button"
                  onClick={() => setViewMode("new-chat")}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-emerald-600 transition cursor-pointer"
                  title="New Chat"
                  aria-label="New chat"
                >
                  <SquarePen className="size-4" />
                </button>
              )}

              {/* Fullscreen into /connect */}
              <button
                type="button"
                onClick={() => router.push(activeConvId ? `/connect?conversationId=${activeConvId}` : "/connect")}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:text-slate-300 transition cursor-pointer"
                title="Open in Full Screen"
                aria-label="Open in full screen"
              >
                <ExternalLink className="size-3.5" />
              </button>

              {/* Minimize to FAB */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:text-slate-300 transition cursor-pointer"
                title="Minimize"
                aria-label="Minimize"
              >
                <Minus className="size-3.5" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:text-slate-300 transition cursor-pointer"
                title="Close"
                aria-label="Close chat"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {viewMode === "new-chat" ? (
            <NewChatPanel
              currentUserId={authUser?.id}
              onStarted={(convId, name) => {
                openConversation(convId, name);
                loadConversations();
              }}
            />
          ) : viewMode === "conversations" ? (
            /* WhatsApp Conversation List View */
            <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21] flex flex-col">
              <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-[#f0f2f5] dark:bg-[#202c33]">
                <div className="relative">
                  <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    placeholder="Search colleagues or chats..."
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-[#2a3942] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Start a chat with anyone in the directory, not only existing conversations */}
                <button
                  type="button"
                  onClick={() => setViewMode("new-chat")}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] cursor-pointer transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <div className="size-10 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <UserPlus className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-slate-900 dark:text-white">New chat</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Message any colleague from the directory</p>
                  </div>
                </button>
                {isLoadingConversations ? (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="size-5 animate-spin text-emerald-600" />
                    <span className="text-xs">Loading chats...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center p-4">
                    <MessageCircle className="size-8 text-slate-300 dark:text-slate-600 mb-1" />
                    <p className="text-xs font-medium">No chats found</p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openConversation(conv.id, conv.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openConversation(conv.id, conv.name);
                        }
                      }}
                      className={`flex items-center gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] cursor-pointer transition focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                        activeConvId === conv.id ? "bg-[#f0f2f5] dark:bg-[#202c33]" : ""
                      }`}
                    >
                      <div className="size-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {conv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                            {conv.name}
                          </h4>
                          {conv.lastMessage?.createdAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                            {conv.lastMessage?.body || "Tap to chat"}
                          </p>
                          {conv.unreadCount && conv.unreadCount > 0 ? (
                            <span className="size-4.5 rounded-full bg-[#25d366] text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                              {conv.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* WhatsApp Chat Message View */
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
                {isLoadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="size-5 animate-spin text-emerald-600" />
                    <span className="text-[11px]">Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                    <MessageSquare className="size-8 text-emerald-600/40 mb-2" />
                    <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                      Chat with {activeConvName}
                    </p>
                    <p className="text-[11px] mt-0.5 text-slate-500">
                      Send a message without leaving your active work page
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMe = String(m.senderId).toLowerCase() === String(authUser?.id).toLowerCase();
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const dateLabel = getMessageDateLabel(m.rawDate);
                    const prevDateLabel = prevMsg ? getMessageDateLabel(prevMsg.rawDate) : null;
                    const showDateHeader = !prevMsg || dateLabel !== prevDateLabel;

                    // Only real call-log records; a normal text saying "video call tomorrow" is a chat bubble.
                    const isCallLog = m.type === "CALL_LOG";

                    return (
                      <React.Fragment key={m.id}>
                        {/* Centered WhatsApp Date Header Pill */}
                        {showDateHeader && (
                          <div className="flex justify-center my-2">
                            <span className="rounded-md bg-white/90 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 px-3 py-0.5 shadow-2xs border border-slate-200/50 dark:border-slate-700/50 select-none">
                              {dateLabel}
                            </span>
                          </div>
                        )}

                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          {isCallLog ? (
                            /* WhatsApp Voice / Video Call Card */
                            <div className="bg-white/95 dark:bg-[#1f2c34] border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 shadow-xs space-y-1 max-w-[85%]">
                              <div className="flex items-center gap-2.5">
                                <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <Phone className="size-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 dark:text-white">Call</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 break-words">{m.body}</p>
                                </div>
                              </div>
                              {m.createdAt && (
                                <span className="text-[9px] text-slate-400 block text-right font-mono">
                                  {m.createdAt}
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Standard WhatsApp Speech Bubble */
                            <div
                              className={`max-w-[85%] px-3 py-2 text-xs shadow-xs transition-all ${
                                isMe
                                  ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-2xl rounded-tr-xs ml-auto"
                                  : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-2xl rounded-tl-xs mr-auto border border-slate-200/60 dark:border-slate-700/60"
                              }`}
                            >
                              {!isMe && (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                                  {m.senderName}
                                </span>
                              )}
                              <p className={`whitespace-pre-wrap break-words leading-relaxed ${
                                m.deletedAt ? "italic text-slate-500 dark:text-slate-400" : ""
                              }`}>
                                {m.body}
                              </p>

                              {/* Attachment preview if any */}
                              {m.attachments && m.attachments.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {m.attachments.map((att, aIdx) => {
                                    const isImg =
                                      att.mimeType?.startsWith("image/") ||
                                      att.url?.match(/\.(jpeg|jpg|gif|png|webp)/i);
                                    return (
                                      <div key={aIdx} className="mt-1">
                                        {isImg ? (
                                          <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
                                          >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                              src={att.url}
                                              alt={att.name}
                                              className="max-h-48 rounded-lg object-cover hover:opacity-90 transition"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition"
                                          >
                                            <FileText className="size-4 text-emerald-600 shrink-0" />
                                            <span className="truncate underline font-medium text-[11px]">{att.name}</span>
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Footer Timestamp & Status */}
                              <div className="flex items-center justify-end gap-1 mt-1 select-none">
                                {m.createdAt && (
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                                    {m.createdAt}
                                  </span>
                                )}
                                {isMe && (
                                  <CheckCheck
                                    className={`size-3 inline shrink-0 ${
                                      m.status === "read" ? "text-[#53bdeb]" : "text-slate-400"
                                    }`}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* WhatsApp Input Bar Footer */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-700/80 flex items-center gap-2 shrink-0 select-none"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer shrink-0"
                  title="Attach file"
                  aria-label="Attach file"
                >
                  <Paperclip className="size-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message... (Enter to send)"
                  aria-label="Message"
                  className="flex-1 h-9 px-4 text-xs sm:text-sm rounded-full bg-white dark:bg-[#2a3942] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="size-9 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shadow-md shrink-0 active:scale-95"
                  title="Send message"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
