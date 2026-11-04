"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Phone, PhoneOff, Video, X, MessageSquare, ArrowRight } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { getPusherClient } from "@/lib/connect/pusher-client";
import {
  startIncomingRingtone,
  stopRingtone,
  playMessageChime,
} from "@/lib/connect/webrtc";

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

export function ConnectGlobalNotifier() {
  const { user: authUser } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [toasts, setToasts] = useState<MessageToastData[]>([]);
  const incomingCallRef = useRef<IncomingCallData | null>(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Request browser Notification permission on mount if supported
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

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
          // If the user is already on /connect, the in-chat handler will manage it,
          // but if they are on another page (or minimized), this global alert fires!
          if (pathname !== "/connect") {
            const callData: IncomingCallData = {
              conversationId: signal.conversationId,
              callerId: signal.senderId,
              callerName: signal.senderName || "Colleague",
              callType: signal.callType || "audio",
              timestamp: Date.now(),
            };

            setIncomingCall(callData);
            startIncomingRingtone();

            // Native browser notification if window is blurred or minimized
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                const notif = new Notification(`Incoming ${signal.callType === "video" ? "Video" : "Voice"} Call`, {
                  body: `${signal.senderName || "Colleague"} is calling you on BRG Connect. Click to answer.`,
                  icon: "/favicon.ico",
                  tag: `call-${signal.conversationId}`,
                });
                notif.onclick = () => {
                  window.focus();
                  stopRingtone();
                  setIncomingCall(null);
                  router.push(`/connect?conversationId=${signal.conversationId}&autoAccept=true`);
                };
              } catch {}
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

        // If the user is currently on /connect, the main chat UI updates in place
        if (pathname === "/connect") return;

        // Format message preview text
        let previewText = msg.body?.trim() || "";
        const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
        if (!previewText && hasAttachments) {
          previewText = "Sent a file attachment";
        } else if (msg.type === "erp_card" || msg.type === "ERP_CARD") {
          previewText = "Shared a live ERP document card";
        }

        // Play pleasant notification sound
        playMessageChime();

        // Show floating message toast
        const newToast: MessageToastData = {
          id: msg.id || `toast-${Date.now()}-${Math.random()}`,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          senderName: msg.senderName || "Colleague",
          body: previewText,
          type: msg.type || "text",
          hasAttachment: hasAttachments,
        };

        setToasts((prev) => [newToast, ...prev.slice(0, 2)]);

        // Auto remove toast after 6 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, 6000);

        // Native browser background notification if tab is hidden
        if (
          typeof document !== "undefined" &&
          document.hidden &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const notif = new Notification(msg.senderName || "BRG Connect", {
              body: previewText || "You have a new message",
              icon: "/favicon.ico",
              tag: `msg-${msg.conversationId}`,
            });
            notif.onclick = () => {
              window.focus();
              router.push(`/connect?conversationId=${msg.conversationId}`);
            };
          } catch {}
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
    const { conversationId } = incomingCall;
    stopRingtone();
    setIncomingCall(null);
    router.push(`/connect?conversationId=${conversationId}&autoAccept=true`);
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

  const handleOpenConversation = (conversationId: string) => {
    router.push(`/connect?conversationId=${conversationId}`);
  };

  return (
    <>
      {/* 1. WhatsApp-Style Incoming Call Banner Overlay */}
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

      {/* 2. Floating Message Notification Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-surface dark:bg-slate-900 border border-line shadow-xl rounded-xl p-3.5 flex items-start gap-3 transition-all hover:border-blue-500/50 animate-in slide-in-from-bottom-5 duration-200"
            >
              <div className="size-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {toast.senderName.slice(0, 2).toUpperCase()}
              </div>

              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleOpenConversation(toast.conversationId)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-ink dark:text-white truncate">
                    {toast.senderName}
                  </span>
                  <span className="text-[10px] text-ink-muted">Just now</span>
                </div>
                <p className="text-xs text-ink-muted line-clamp-2 mt-0.5 font-normal">
                  {toast.body}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  <MessageSquare className="size-3" />
                  <span>Reply in Connect</span>
                  <ArrowRight className="size-3" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDismissToast(toast.id)}
                className="text-ink-muted hover:text-ink p-1 rounded-md transition cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
