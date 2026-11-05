"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Phone,
  PhoneOff,
  Video,
  X,
  MessageSquare,
  Bell,
  Send,
  Minus,
  ExternalLink,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { getPusherClient } from "@/lib/connect/pusher-client";
import {
  startIncomingRingtone,
  stopRingtone,
  playMessageChime,
} from "@/lib/connect/webrtc";

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

interface MessageToastData {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  type: string;
  hasAttachment?: boolean;
}

interface ActiveMiniChat {
  conversationId: string;
  senderName: string;
  isMinimized: boolean;
}

interface MiniChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export function ConnectGlobalNotifier() {
  const { user: authUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [toasts, setToasts] = useState<MessageToastData[]>([]);
  const [toastReplyInputs, setToastReplyInputs] = useState<Record<string, string>>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [hidePermissionBanner, setHidePermissionBanner] = useState(false);

  // Floating Mini Chat (PiP Messenger across all ERP pages)
  const [activeMiniChat, setActiveMiniChat] = useState<ActiveMiniChat | null>(null);
  const [miniChatMessages, setMiniChatMessages] = useState<MiniChatMessage[]>([]);
  const [miniChatInput, setMiniChatInput] = useState("");
  const [isMiniChatLoading, setIsMiniChatLoading] = useState(false);
  const [isMiniChatSending, setIsMiniChatSending] = useState(false);

  const miniChatEndRef = useRef<HTMLDivElement | null>(null);
  const activeMiniChatRef = useRef<ActiveMiniChat | null>(null);
  const incomingCallRef = useRef<IncomingCallData | null>(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeMiniChatRef.current = activeMiniChat;
  }, [activeMiniChat]);

  // Auto-scroll mini chat to bottom on new messages
  useEffect(() => {
    if (activeMiniChat && !activeMiniChat.isMinimized) {
      miniChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [miniChatMessages, activeMiniChat]);

  // Request browser Notification permission via direct user action
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
            body: "ডেস্কটপ নোটিফিকেশন সফলভাবে চালু হয়েছে! ব্রাউজার ব্যাকগ্রাউন্ডে থাকলেও স্ক্রিনের কোণায় কল ও মেসেজ ভেসে উঠবে।",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "brg-welcome",
          });
          testNotif.onclick = () => window.focus();
        } catch {}
      }
    } catch (err) {
      console.warn("Notification permission error:", err);
    }
  };

  // Open Floating Mini Chat window on current page
  const openMiniChat = async (conversationId: string, senderName: string) => {
    if (!conversationId) return;

    setActiveMiniChat({
      conversationId,
      senderName,
      isMinimized: false,
    });

    // Dismiss any matching toast
    setToasts((prev) => prev.filter((t) => t.conversationId !== conversationId));

    // Auto mark as read in DB & Pusher
    try {
      fetch(`/api/connect/conversations/${conversationId}/read`, { method: "POST" }).catch(() => {});
    } catch {}

    // Fetch conversation messages
    setIsMiniChatLoading(true);
    try {
      const res = await fetch(`/api/connect/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages)) {
        setMiniChatMessages(
          data.messages.slice(-30).map((m: {
            id: string;
            senderId: string;
            senderName: string;
            body: string;
            type?: string;
            deletedAt?: string | null;
            createdAt?: string;
          }) => {
            let bodyText = m.body;
            if (m.deletedAt) {
              bodyText = "This message was deleted";
            } else if (!bodyText) {
              if (m.type === "FILE") bodyText = "📎 Sent a file attachment";
              else if (m.type === "ERP_CARD") bodyText = "📋 Shared live ERP record";
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
              createdAt: formattedTime,
            };
          })
        );
      }
    } catch (err) {
      console.warn("Could not load mini chat messages:", err);
    } finally {
      setIsMiniChatLoading(false);
    }
  };

  // Send message from Mini Chat
  const handleSendMiniChatMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!miniChatInput.trim() || !activeMiniChat || !authUser?.id) return;
    const textToSend = miniChatInput.trim();
    const convId = activeMiniChat.conversationId;
    const clientMsgId = `c-mini-${Date.now()}`;

    const optimisticMsg: MiniChatMessage = {
      id: `m-opt-${Date.now()}`,
      senderId: authUser.id,
      senderName: authUser.name || "Me",
      body: textToSend,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMiniChatMessages((prev) => [...prev, optimisticMsg]);
    setMiniChatInput("");

    try {
      setIsMiniChatSending(true);
      await fetch(`/api/connect/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientMsgId,
          type: "TEXT",
          bodyText: textToSend,
          senderId: authUser.id,
          senderName: authUser.name || "Me",
        }),
      });
    } catch (err) {
      console.warn("Failed to send quick message:", err);
    } finally {
      setIsMiniChatSending(false);
    }
  };

  // Quick reply directly from toast input without opening full mini chat
  const handleSendToastReply = async (toast: MessageToastData) => {
    const text = (toastReplyInputs[toast.id] || "").trim();
    if (!text || !authUser?.id) return;

    // Clear toast input & dismiss
    setToastReplyInputs((prev) => {
      const next = { ...prev };
      delete next[toast.id];
      return next;
    });
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));

    // Open the mini chat so user can see conversation continuing seamlessly
    await openMiniChat(toast.conversationId, toast.senderName);

    // Optimistically add to mini chat messages so user sees it instantly
    const optimisticMsg: MiniChatMessage = {
      id: `m-opt-${Date.now()}`,
      senderId: authUser.id,
      senderName: authUser.name || "Me",
      body: text,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMiniChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      await fetch(`/api/connect/conversations/${toast.conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientMsgId: `c-quick-${Date.now()}`,
          type: "TEXT",
          bodyText: text,
          senderId: authUser.id,
          senderName: authUser.name || "Me",
        }),
      });
    } catch (err) {
      console.warn("Toast reply failed:", err);
    }
  };

  // Listen to global Pusher events
  useEffect(() => {
    if (!authUser?.id) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe("connect-global");

    // 1. Incoming Call Signal Handler
    channel.bind(
      "call-signal",
      (signal: {
        conversationId: string;
        senderId: string;
        senderName: string;
        type: string;
        callType: "audio" | "video";
      }) => {
        // Ignore calls originated by ourselves
        if (signal.senderId === authUser.id) return;

        // When someone is calling us
        if (signal.type === "call-request") {
          const isTabHidden = typeof document !== "undefined" && document.hidden;
          const isDifferentPage = pathname !== "/connect";

          const callData: IncomingCallData = {
            conversationId: signal.conversationId,
            callerId: signal.senderId,
            callerName: signal.senderName || "Colleague",
            callType: signal.callType || "audio",
            timestamp: Date.now(),
          };

          // Show in-app call modal if not already on /connect
          if (isDifferentPage) {
            setIncomingCall(callData);
            startIncomingRingtone();
          }

          // Native Windows desktop notification
          if ((isTabHidden || isDifferentPage) && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                const callOptions: ExtendedNotificationOptions = {
                  body: `${signal.callType === "video" ? "📹 Incoming Video Call" : "🎙️ Incoming Voice Call"} on BRG Connect. Click here to answer.`,
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
                  router.push(`/connect?conversationId=${signal.conversationId}&autoAccept=true`);
                };
              } catch (e) {
                console.warn("[WebRTC] Native desktop call notification error:", e);
              }
            }
          }
        }

        // When caller cancels, hangs up, or someone rejects
        if (signal.type === "call-reject" || signal.type === "call-hangup") {
          if (incomingCallRef.current?.conversationId === signal.conversationId) {
            stopRingtone();
            setIncomingCall(null);
          }
        }
      }
    );

    // 2. Incoming New Message Handler
    channel.bind(
      "new-message",
      (msg: {
        id: string;
        conversationId: string;
        senderId: string;
        senderName: string;
        body?: string;
        type?: string;
        attachments?: unknown[];
      }) => {
        // Ignore our own messages
        if (msg.senderId === authUser.id) return;

        const isTabHidden = typeof document !== "undefined" && document.hidden;
        const isDifferentPage = pathname !== "/connect";

        // Format message preview text
        let previewText = msg.body?.trim() || "";
        const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
        if (!previewText && hasAttachments) {
          previewText = "Sent a file attachment";
        } else if (msg.type === "erp_card" || msg.type === "ERP_CARD") {
          previewText = "Shared a live ERP document card";
        }

        // Live update active mini chat if already chatting with this user on this page
        if (activeMiniChatRef.current?.conversationId === msg.conversationId) {
          setMiniChatMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              senderId: msg.senderId,
              senderName: msg.senderName,
              body: previewText,
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }

        // If on another page, play chime and show in-app floating quick-reply toast
        if (isDifferentPage) {
          playMessageChime();

          const newToast: MessageToastData = {
            id: msg.id || `toast-${Date.now()}-${Math.random()}`,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName: msg.senderName || "Colleague",
            body: previewText,
            type: msg.type || "text",
            hasAttachment: hasAttachments,
          };

          setToasts((prev) => [newToast, ...prev.filter((t) => t.conversationId !== msg.conversationId).slice(0, 2)]);

          // Auto remove after 9 seconds if user doesn't interact
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
          }, 9000);
        } else if (isTabHidden) {
          playMessageChime();
        }

        // Native Windows desktop notification in the screen corner
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
                openMiniChat(msg.conversationId, msg.senderName || "Colleague");
              };
            } catch (e) {
              console.warn("[WebRTC] Native desktop message notification error:", e);
            }
          }
        }
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("connect-global");
      stopRingtone();
    };
  }, [authUser?.id, pathname, router]);

  // Handle Accept Call
  const handleAcceptCall = () => {
    if (!incomingCall) return;
    const { conversationId, callType } = incomingCall;
    stopRingtone();
    setIncomingCall(null);
    router.push(`/connect?conversationId=${conversationId}&autoAccept=true&callType=${callType || "audio"}`);
  };

  // Handle Decline Call
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
    } catch {
      // Ignored
    }
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {/* 1. Desktop Notification Permission Prompt Banner in Screen Corner */}
      {notificationPermission === "default" && !hidePermissionBanner && (
        <div className="fixed top-16 right-5 z-[9998] max-w-sm w-full rounded-xl border border-blue-500/40 bg-surface dark:bg-slate-900 p-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
            <Bell className="size-4 animate-bounce" />
          </div>
          <div className="flex-1 text-xs space-y-1.5">
            <p className="font-semibold text-ink dark:text-white">ডেস্কটপ নোটিফিকেশন চালু করুন</p>
            <p className="text-ink-muted text-[11px] leading-relaxed">
              ব্রাউজার মিনিমাইজ থাকলেও স্ক্রিনের কোণায় কল ও মেসেজ পপআপ পাওয়ার জন্য অনুমতি দিন।
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] cursor-pointer transition shadow-xs"
              >
                অনুমতি দিন (Allow)
              </button>
              <button
                type="button"
                onClick={() => setHidePermissionBanner(true)}
                className="px-2 py-1 text-ink-muted hover:text-ink text-[11px] cursor-pointer"
              >
                পরে
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHidePermissionBanner(true)}
            className="text-ink-muted hover:text-ink cursor-pointer p-0.5 rounded"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 2. WhatsApp-Style Incoming Call Banner Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 text-white p-6 shadow-2xl text-center space-y-6">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              {/* Outer Pulsing Rings */}
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
              <span className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />

              {/* Avatar Center */}
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

            {/* Accept & Decline Buttons */}
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

      {/* 3. Floating Quick-Reply Message Toasts (Hovering on current page) */}
      {toasts.length > 0 && !activeMiniChat && (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-surface dark:bg-slate-900 border-2 border-blue-500/40 shadow-2xl rounded-2xl p-4 flex flex-col gap-2.5 transition-all hover:border-blue-500 animate-in slide-in-from-bottom-5 duration-200"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {toast.senderName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-ink dark:text-white truncate block">
                      {toast.senderName}
                    </span>
                    <span className="text-[10px] text-ink-muted">Just now</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openMiniChat(toast.conversationId, toast.senderName)}
                    className="p-1 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition cursor-pointer"
                    title="Open on-page chat drawer"
                  >
                    <MessageCircle className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissToast(toast.id)}
                    className="text-ink-muted hover:text-ink p-1 rounded-md transition cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Message snippet */}
              <p className="text-xs text-ink-muted dark:text-slate-300 line-clamp-2 font-normal leading-relaxed pl-0.5">
                {toast.body}
              </p>

              {/* Instant Quick Reply Row right on the toast */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-line/60">
                <input
                  type="text"
                  value={toastReplyInputs[toast.id] || ""}
                  onChange={(e) =>
                    setToastReplyInputs((prev) => ({ ...prev, [toast.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendToastReply(toast);
                    }
                  }}
                  placeholder="Quick reply without leaving page..."
                  className="flex-1 h-7 text-[11px] px-2.5 rounded-lg border border-line bg-surface dark:bg-slate-950 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSendToastReply(toast)}
                  disabled={!(toastReplyInputs[toast.id] || "").trim()}
                  className="size-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shadow-xs shrink-0"
                  title="Send quick reply"
                >
                  <Send className="size-3" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <button
                  type="button"
                  onClick={() => openMiniChat(toast.conversationId, toast.senderName)}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="size-3" />
                  <span>Open On-Page Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/connect?conversationId=${toast.conversationId}`)}
                  className="text-ink-muted hover:text-ink flex items-center gap-0.5 text-[10px] cursor-pointer"
                >
                  <span>Full Screen</span>
                  <ExternalLink className="size-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Floating Mini Chat Window (Work on page & chat simultaneously) */}
      {activeMiniChat && (
        <div
          className={`fixed bottom-5 right-5 z-[9999] pointer-events-auto transition-all duration-200 ${
            activeMiniChat.isMinimized
              ? "w-auto"
              : "w-80 sm:w-96 h-[440px] rounded-2xl bg-surface dark:bg-slate-900 border-2 border-line dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
          }`}
        >
          {activeMiniChat.isMinimized ? (
            /* Minimized Pill Badge in Corner */
            <div
              onClick={() => setActiveMiniChat((prev) => (prev ? { ...prev, isMinimized: false } : null))}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl cursor-pointer transition animate-in zoom-in-95 group"
            >
              <div className="relative">
                <MessageCircle className="size-5" />
                <span className="size-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse" />
              </div>
              <span className="font-semibold text-xs truncate max-w-[150px]">
                {activeMiniChat.senderName}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMiniChat(null);
                }}
                className="p-1 rounded-full hover:bg-white/20 transition cursor-pointer"
                title="Close chat"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            /* Full Floating Mini Chat Box */
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-control/40 dark:bg-slate-950/80 border-b border-line">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {activeMiniChat.senderName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-ink dark:text-white truncate">
                      {activeMiniChat.senderName}
                    </h4>
                    <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span>On-Page Live Chat</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-ink-muted">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMiniChat((prev) => (prev ? { ...prev, isMinimized: true } : null))
                    }
                    className="p-1 rounded hover:bg-control hover:text-ink transition cursor-pointer"
                    title="Minimize to corner bubble"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/connect?conversationId=${activeMiniChat.conversationId}`)
                    }
                    className="p-1 rounded hover:bg-control hover:text-ink transition cursor-pointer"
                    title="Open Full Screen Chat"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMiniChat(null)}
                    className="p-1 rounded hover:bg-control hover:text-ink transition cursor-pointer"
                    title="Close chat"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-canvas/30 dark:bg-slate-950/40 text-xs">
                {isMiniChatLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-ink-muted">
                    <Loader2 className="size-5 animate-spin text-blue-600" />
                    <span className="text-[11px]">Loading conversation...</span>
                  </div>
                ) : miniChatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-ink-muted">
                    <MessageSquare className="size-8 text-blue-500/40 mb-2" />
                    <p className="font-medium text-xs">Start a conversation</p>
                    <p className="text-[10px] mt-0.5">Send a quick reply without leaving this page</p>
                  </div>
                ) : (
                  miniChatMessages.map((m) => {
                    const isMe = m.senderId === authUser?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-2xs ${
                            isMe
                              ? "bg-blue-600 text-white rounded-tr-xs"
                              : "bg-surface dark:bg-slate-800 text-ink dark:text-slate-200 border border-line rounded-tl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                          {m.createdAt && (
                            <span
                              className={`text-[9px] block text-right mt-1 opacity-75 font-mono`}
                            >
                              {m.createdAt}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={miniChatEndRef} />
              </div>

              {/* Quick Reply Form Footer */}
              <form
                onSubmit={handleSendMiniChatMessage}
                className="p-2.5 bg-surface dark:bg-slate-900 border-t border-line flex items-center gap-2"
              >
                <input
                  type="text"
                  value={miniChatInput}
                  onChange={(e) => setMiniChatInput(e.target.value)}
                  placeholder="Type a message... (Enter to send)"
                  disabled={isMiniChatSending}
                  className="flex-1 h-9 px-3 text-xs rounded-xl border border-line bg-canvas dark:bg-slate-950 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!miniChatInput.trim() || isMiniChatSending}
                  className="size-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition cursor-pointer shadow-xs shrink-0"
                  title="Send message"
                >
                  {isMiniChatSending ? (
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
