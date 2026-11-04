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
  Briefcase,
  Monitor,
  MessageSquarePlus,
} from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { getPusherClient } from "@/lib/connect/pusher-client";
import {
  RTC_CONFIG,
  startIncomingRingtone,
  startOutgoingRingback,
  stopRingtone,
} from "@/lib/connect/webrtc";
import type {
  ConnectConversation,
  ConnectMessage,
  ConnectUser,
  ErpRecordCard,
  MessageDeliveryStatus,
} from "@/features/connect/types";

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarBg(name?: string | null): string {
  const colors = [
    "bg-blue-600 text-white",
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function BrgConnectChatPage() {
  const { user: authUser } = useSession();

  const [conversations, setConversations] = useState<ConnectConversation[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, ConnectMessage[]>>({});
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const activeConvIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);
  const [filterTab, setFilterTab] = useState<"all" | "direct" | "group" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ConnectMessage | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Real data from DB
  const [realErpRecords, setRealErpRecords] = useState<ErpRecordCard[]>([]);
  const [directoryEmployees, setDirectoryEmployees] = useState<ConnectUser[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");

  // Modals
  const [isErpPickerOpen, setIsErpPickerOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  // WebRTC Call state
  const [activeCall, setActiveCall] = useState<{
    type: "audio" | "video";
    status: "ringing" | "connected";
    durationSec: number;
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing: boolean;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<{
    conversationId: string;
    callerId: string;
    callerName: string;
    callType: "audio" | "video";
    offer?: RTCSessionDescriptionInit | null;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Load real conversations from Neon DB
  const loadConversations = async () => {
    try {
      const res = await fetch("/api/connect/conversations");
      const data = await res.json();
      if (data.success && Array.isArray(data.conversations)) {
        const mapped: ConnectConversation[] = data.conversations.map(
          (c: {
            id: string;
            type: string;
            name: string;
            description?: string;
            createdAt: string;
            lastMessage?: {
              id: string;
              body: string;
              type: string;
              createdAt: string;
              senderId: string;
            };
          }) => ({
            id: c.id,
            type: c.type.toLowerCase() as "direct" | "group",
            name: c.name || "Conversation",
            description: c.description,
            members: [authUser?.id || "user-current"],
            unreadCount: 0,
            lastMessage: c.lastMessage
              ? {
                  id: c.lastMessage.id,
                  conversationId: c.id,
                  senderId: c.lastMessage.senderId,
                  senderName: c.lastMessage.senderId === authUser?.id ? (authUser?.name || "Me") : "Member",
                  clientMsgId: `c-${c.lastMessage.id}`,
                  type: "text",
                  body: c.lastMessage.body,
                  status: "seen",
                  createdAt: new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                }
              : undefined,
            createdAt: c.createdAt,
          })
        );
        setConversations(mapped);
        if (mapped.length > 0 && !activeConvId) {
          setActiveConvId(mapped[0].id);
        }
      }
    } catch {
      // Offline or network error
    }
  };

  // Load real messages for conversation from Neon DB
  const loadMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/connect/conversations/${convId}/messages`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        const mapped: ConnectMessage[] = data.messages.map(
          (m: {
            id: string;
            conversationId: string;
            senderId: string;
            senderName?: string;
            clientMsgId: string;
            type: string;
            body: string;
            erpRecordType?: string;
            erpRecordData?: ErpRecordCard;
            createdAt: string;
            attachments?: Array<{
              id: string;
              name: string;
              sizeBytes: number;
              mimeType: string;
              url: string;
            }>;
          }) => ({
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: m.senderId === authUser?.id ? (authUser?.name || "Me") : (m.senderName || "Colleague"),
            clientMsgId: m.clientMsgId || `c-${m.id}`,
            type: (m.type.toLowerCase() as "text" | "erp_card" | "file") || "text",
            body: m.body,
            erpRecord: m.erpRecordData || undefined,
            attachments: m.attachments?.map((a) => ({
              ...a,
              type: a.mimeType?.startsWith("image/") ? "image" : a.mimeType?.includes("pdf") ? "doc" : "file",
            })),
            status: "seen" as MessageDeliveryStatus,
            createdAt: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          })
        );
        setMessagesMap((prev) => ({ ...prev, [convId]: mapped }));
      }
    } catch {
      // Ignored
    }
  };

  // Load real employees for DM and Channel modals
  const loadDirectory = async () => {
    try {
      const res = await fetch("/api/connect/directory?limit=1000");
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        const mapped: ConnectUser[] = data.employees.map(
          (e: {
            id: string;
            name: string;
            designation: string;
            department: string;
            employeeCode: string;
            phone: string;
            email: string;
            officeName: string;
            isActive: boolean;
          }) => ({
            id: e.id,
            name: e.name,
            department: e.department || "General",
            designation: e.designation || "Staff",
            phone: e.phone || "",
            email: e.email || "",
            officeName: e.officeName || "Office",
            status: e.isActive ? "online" : "offline",
            role: "member",
          })
        );
        setDirectoryEmployees(mapped);
      }
    } catch {
      // Ignored
    }
  };

  // Initial load
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      loadConversations();
      loadDirectory();
      fetch("/api/connect/erp-records")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d?.success && Array.isArray(d.records)) {
            setRealErpRecords(d.records);
          }
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, []);

  // When active conversation changes, load messages
  useEffect(() => {
    let active = true;
    if (activeConvId) {
      queueMicrotask(() => {
        if (active) loadMessages(activeConvId);
      });
    }
    return () => {
      active = false;
    };
  }, [activeConvId]);

  // Active conversation object
  const activeConv = useMemo(() => {
    return conversations.find((c) => c.id === activeConvId) ?? null;
  }, [conversations, activeConvId]);

  // Current messages
  const activeMessages = useMemo(() => {
    if (!activeConvId) return [];
    return messagesMap[activeConvId] ?? [];
  }, [messagesMap, activeConvId]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeConvId]);

  // Call duration timer
  useEffect(() => {
    if (!activeCall || activeCall.status !== "connected") return;
    const interval = setInterval(() => {
      setActiveCall((prev) => (prev ? { ...prev, durationSec: prev.durationSec + 1 } : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const sendCallSignal = async (
    convId: string,
    type: string,
    callType: "audio" | "video",
    sdp?: RTCSessionDescriptionInit | null,
    candidate?: RTCIceCandidateInit | null
  ) => {
    try {
      await fetch("/api/connect/calls/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          type,
          callType,
          sdp,
          candidate,
        }),
      });
    } catch (err) {
      console.warn("Signal send failed:", err);
    }
  };

  const cleanupCall = () => {
    stopRingtone();
    queuedIceCandidatesRef.current = [];
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
  };

  const initPeerConnection = (convId: string, callType: "audio" | "video") => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal(convId, "ice-candidate", callType, null, event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Peer connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
      } else if (pc.connectionState === "failed") {
        console.warn("[WebRTC] Connection failed, attempting ICE restart...");
        if (typeof pc.restartIce === "function") {
          pc.restartIce();
        }
      }
    };

    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received:", event.track.kind);
      const stream = (event.streams && event.streams[0])
        ? event.streams[0]
        : new MediaStream([event.track]);
      remoteStreamRef.current = stream;

      // 1. Play audio immediately via dedicated audio element
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) => {
          console.warn("[WebRTC] Audio auto-play restricted by browser policy:", err);
        });
      }

      // 2. Attach video if in video call
      if (remoteVideoRef.current && callType === "video") {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, mediaStreamRef.current!);
      });
    }

    return pc;
  };

  // Realtime Pusher subscription for global updates
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const globalChannel = pusher.subscribe("connect-global");

    globalChannel.bind("new-conversation", () => {
      loadConversations();
    });

    globalChannel.bind("new-message", (msg: ConnectMessage) => {
      // Append to active message thread immediately
      setMessagesMap((prev) => {
        const list = prev[msg.conversationId] || [];
        const exists = list.some(
          (m) => m.id === msg.id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
        );
        if (exists) {
          return {
            ...prev,
            [msg.conversationId]: list.map((m) =>
              m.id === msg.id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
                ? { ...msg, status: "delivered" }
                : m
            ),
          };
        }
        return {
          ...prev,
          [msg.conversationId]: [...list, msg],
        };
      });

      // Update sidebar conversation list
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === msg.conversationId);
        if (!exists) {
          loadConversations();
          return prev;
        }
        return prev.map((c) => {
          if (c.id === msg.conversationId) {
            const isCurrentActive = c.id === activeConvIdRef.current;
            return {
              ...c,
              unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + 1,
              lastMessage: {
                id: msg.id,
                conversationId: msg.conversationId,
                senderId: msg.senderId,
                senderName: msg.senderName,
                clientMsgId: msg.clientMsgId,
                type: msg.type,
                body: msg.body,
                status: "delivered",
                createdAt: msg.createdAt,
              },
            };
          }
          return c;
        });
      });
    });

    // Realtime WebRTC call signaling via Pusher
    globalChannel.bind(
      "call-signal",
      async (signal: {
        conversationId: string;
        senderId: string;
        senderName: string;
        type: string;
        callType: "audio" | "video";
        sdp?: RTCSessionDescriptionInit | null;
        candidate?: RTCIceCandidateInit | null;
        hasRemoteSdp?: boolean;
      }) => {
        if (signal.senderId === authUser?.id) return;

        switch (signal.type) {
          case "call-request": {
            let offerSdp = signal.sdp || null;
            if (!offerSdp && signal.hasRemoteSdp) {
              try {
                const res = await fetch(`/api/connect/calls/signal?conversationId=${signal.conversationId}`);
                const data = await res.json();
                if (data.success && data.sdp) offerSdp = data.sdp;
              } catch (e) {
                console.warn("[WebRTC] Error fetching offer SDP:", e);
              }
            }

            setIncomingCall({
              conversationId: signal.conversationId,
              callerId: signal.senderId,
              callerName: signal.senderName,
              callType: signal.callType,
              offer: offerSdp,
            });
            startIncomingRingtone();
            break;
          }

          case "call-accept": {
            stopRingtone();
            let answerSdp = signal.sdp || null;
            if (!answerSdp && signal.hasRemoteSdp) {
              try {
                const res = await fetch(`/api/connect/calls/signal?conversationId=${signal.conversationId}`);
                const data = await res.json();
                if (data.success && data.sdp) answerSdp = data.sdp;
              } catch (e) {
                console.warn("[WebRTC] Error fetching answer SDP:", e);
              }
            }

            if (answerSdp && peerConnectionRef.current) {
              try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSdp));
                while (queuedIceCandidatesRef.current.length > 0) {
                  const cand = queuedIceCandidatesRef.current.shift();
                  if (cand) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                }
              } catch (err) {
                console.warn("[WebRTC] Error setting remote description from answer:", err);
              }
            }
            setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
            break;
          }

          case "webrtc-offer": {
            let offerSdp = signal.sdp || null;
            if (!offerSdp && signal.hasRemoteSdp) {
              try {
                const res = await fetch(`/api/connect/calls/signal?conversationId=${signal.conversationId}`);
                const data = await res.json();
                if (data.success && data.sdp) offerSdp = data.sdp;
              } catch (e) {
                console.warn("[WebRTC] Error fetching offer SDP:", e);
              }
            }

            if (offerSdp && peerConnectionRef.current) {
              try {
                const pc = peerConnectionRef.current;
                await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
                while (queuedIceCandidatesRef.current.length > 0) {
                  const cand = queuedIceCandidatesRef.current.shift();
                  if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendCallSignal(signal.conversationId, "webrtc-answer", signal.callType, answer);
              } catch (err) {
                console.warn("Error handling WebRTC offer:", err);
              }
            }
            break;
          }

          case "webrtc-answer": {
            stopRingtone();
            let answerSdp = signal.sdp || null;
            if (!answerSdp && signal.hasRemoteSdp) {
              try {
                const res = await fetch(`/api/connect/calls/signal?conversationId=${signal.conversationId}`);
                const data = await res.json();
                if (data.success && data.sdp) answerSdp = data.sdp;
              } catch (e) {
                console.warn("[WebRTC] Error fetching answer SDP:", e);
              }
            }

            if (answerSdp && peerConnectionRef.current) {
              try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSdp));
                while (queuedIceCandidatesRef.current.length > 0) {
                  const cand = queuedIceCandidatesRef.current.shift();
                  if (cand) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                }
                setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : null));
              } catch (err) {
                console.warn("Error handling WebRTC answer:", err);
              }
            }
            break;
          }

          case "ice-candidate": {
            if (signal.candidate) {
              const pc = peerConnectionRef.current;
              if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((e) => {
                  console.warn("[WebRTC] Error adding ICE candidate:", e);
                });
              } else {
                queuedIceCandidatesRef.current.push(signal.candidate);
              }
            }
            break;
          }

          case "call-reject": {
            stopRingtone();
            alert(`${signal.senderName || "Colleague"} declined the call.`);
            cleanupCall();
            break;
          }

          case "call-hangup": {
            stopRingtone();
            cleanupCall();
            break;
          }
        }
      }
    );

    return () => {
      globalChannel.unbind_all();
      pusher.unsubscribe("connect-global");
    };
  }, [authUser?.id]);

  // Realtime Pusher subscription for active conversation messages, edits, and deletions
  useEffect(() => {
    if (!activeConvId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `chat-${activeConvId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("new-message", (msg: ConnectMessage) => {
      setMessagesMap((prev) => {
        const list = prev[msg.conversationId] || [];
        const exists = list.some(
          (m) => m.id === msg.id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
        );
        if (exists) {
          return {
            ...prev,
            [msg.conversationId]: list.map((m) =>
              m.id === msg.id || (m.clientMsgId && m.clientMsgId === msg.clientMsgId)
                ? { ...msg, status: "delivered" }
                : m
            ),
          };
        }
        return {
          ...prev,
          [msg.conversationId]: [...list, msg],
        };
      });
    });

    channel.bind(
      "message-edited",
      (data: { messageId: string; conversationId: string; newBody: string }) => {
        setMessagesMap((prev) => {
          const list = prev[data.conversationId] || [];
          return {
            ...prev,
            [data.conversationId]: list.map((m) =>
              m.id === data.messageId ? { ...m, body: data.newBody } : m
            ),
          };
        });
      }
    );

    channel.bind(
      "message-deleted",
      (data: { messageId: string; conversationId: string }) => {
        setMessagesMap((prev) => {
          const list = prev[data.conversationId] || [];
          return {
            ...prev,
            [data.conversationId]: list.map((m) =>
              m.id === data.messageId
                ? {
                    ...m,
                    body: "This message was deleted",
                    erpRecord: undefined,
                    attachments: undefined,
                  }
                : m
            ),
          };
        });
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeConvId]);

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

  // Mark conversation read
  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Send real message to database
  const handleSendMessage = async () => {
    if (!activeConvId || (!messageText.trim() && !replyingTo)) return;
    const textToSend = messageText.trim();
    const currentReply = replyingTo;
    setMessageText("");
    setReplyingTo(null);

    const clientMsgId = `c-${Date.now()}`;
    const newMsg: ConnectMessage = {
      id: `m-${Date.now()}`,
      conversationId: activeConvId,
      senderId: authUser?.id || "user-current",
      senderName: authUser?.name || "Me",
      clientMsgId,
      type: "text",
      body: textToSend,
      replyTo: currentReply
        ? {
            id: currentReply.id,
            senderName: currentReply.senderName,
            body: currentReply.body.slice(0, 70),
          }
        : undefined,
      status: "sending",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Optimistic UI append
    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));

    // Post to real database endpoint
    try {
      const res = await fetch(`/api/connect/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: authUser?.id || "user-current",
          senderName: authUser?.name || "Me",
          clientMsgId,
          type: "TEXT",
          bodyText: textToSend,
          replyToId: currentReply?.id || null,
          replyTo: currentReply
            ? {
                id: currentReply.id,
                senderName: currentReply.senderName,
                body: currentReply.body.slice(0, 70),
              }
            : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        updateMessageStatus(newMsg.id, "delivered");
        setTimeout(() => updateMessageStatus(newMsg.id, "seen"), 1000);
      } else {
        updateMessageStatus(newMsg.id, "sent");
      }
    } catch {
      updateMessageStatus(newMsg.id, "sent");
    }
  };

  const updateMessageStatus = (msgId: string, status: MessageDeliveryStatus) => {
    if (!activeConvId) return;
    setMessagesMap((prev) => {
      const list = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: list.map((m) => (m.id === msgId ? { ...m, status } : m)),
      };
    });
  };

  // Real File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/connect/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.attachment) {
        const clientMsgId = `c-att-${Date.now()}`;
        const newMsg: ConnectMessage = {
          id: `m-att-${Date.now()}`,
          conversationId: activeConvId,
          senderId: authUser?.id || "user-current",
          senderName: authUser?.name || "Me",
          clientMsgId,
          type: "file",
          body: `Shared file: ${data.attachment.name}`,
          attachments: [data.attachment],
          status: "delivered",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessagesMap((prev) => ({
          ...prev,
          [activeConvId]: [...(prev[activeConvId] || []), newMsg],
        }));

        await fetch(`/api/connect/conversations/${activeConvId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: authUser?.id || "user-current",
            senderName: authUser?.name || "Me",
            clientMsgId,
            type: "FILE",
            bodyText: `Shared file: ${data.attachment.name}`,
            attachments: [data.attachment],
          }),
        });
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Share Real ERP Record from Database
  const handleShareErpCard = async (card: ErpRecordCard) => {
    if (!activeConvId) return;
    const clientMsgId = `c-erp-${Date.now()}`;
    const newMsg: ConnectMessage = {
      id: `m-erp-${Date.now()}`,
      conversationId: activeConvId,
      senderId: authUser?.id || "user-current",
      senderName: authUser?.name || "Me",
      clientMsgId,
      type: "erp_card",
      body: `Shared live ERP record (${card.code}) for team review:`,
      erpRecord: card,
      status: "delivered",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg],
    }));
    setIsErpPickerOpen(false);

    try {
      await fetch(`/api/connect/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: authUser?.id || "user-current",
          senderName: authUser?.name || "Me",
          clientMsgId,
          type: "ERP_CARD",
          bodyText: `Shared live ERP record (${card.code}) for team review:`,
          erpRecordType: card.type,
          erpRecordId: card.id,
          erpRecordData: card,
        }),
      });
    } catch {
      // Preserved
    }
  };

  // Edit Message via API
  const handleSaveEdit = async (msgId: string) => {
    if (!editText.trim() || !activeConvId) return;
    const updated = editText.trim();
    setMessagesMap((prev) => {
      const list = prev[activeConvId] || [];
      return {
        ...prev,
        [activeConvId]: list.map((m) =>
          m.id === msgId ? { ...m, body: updated, editedAt: new Date().toLocaleTimeString() } : m
        ),
      };
    });
    setEditingMessageId(null);
    setEditText("");

    try {
      const res = await fetch(`/api/connect/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBody: updated }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to edit message");
        loadMessages(activeConvId);
      }
    } catch {
      // Ignored
    }
  };

  // Delete Message via API
  const handleDeleteMessage = async (msgId: string) => {
    if (!activeConvId) return;
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

      try {
        const res = await fetch(`/api/connect/messages/${msgId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || "Failed to delete message");
          loadMessages(activeConvId);
        }
      } catch {
        // Ignored
      }
    }
  };

  // Real WebRTC Calling & Media Stream
  const handleStartCall = async (type: "audio" | "video") => {
    if (!activeConvId || !activeConv) return;

    // Prime audio playback during user click gesture to satisfy browser autoplay policies
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    setActiveCall({
      type,
      status: "ringing",
      durationSec: 0,
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    });

    startOutgoingRingback();

    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: type === "video",
        });
        mediaStreamRef.current = stream;
        if (localVideoRef.current && type === "video") {
          localVideoRef.current.srcObject = stream;
        }

        const pc = initPeerConnection(activeConvId, type);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendCallSignal(activeConvId, "call-request", type, offer);
      }
    } catch (err) {
      console.warn("Camera/mic access warning:", err);
      stopRingtone();
      alert("Could not access microphone or camera. Please check browser permissions.");
      setActiveCall(null);
    }
  };

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    stopRingtone();

    // Prime audio playback during user click gesture to satisfy browser autoplay policies
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    const convId = incomingCall.conversationId;
    const callType = incomingCall.callType;
    let offer = incomingCall.offer;
    setIncomingCall(null);

    setActiveConvId(convId);

    setActiveCall({
      type: callType,
      status: "connected",
      durationSec: 0,
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
    });

    try {
      // If offer SDP was not in Pusher payload, fetch cached SDP from API
      if (!offer) {
        try {
          const res = await fetch(`/api/connect/calls/signal?conversationId=${convId}`);
          const data = await res.json();
          if (data.success && data.sdp) {
            offer = data.sdp;
          }
        } catch (fetchErr) {
          console.warn("[WebRTC] Could not fetch cached offer SDP:", fetchErr);
        }
      }

      if (typeof navigator !== "undefined" && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: callType === "video",
        });
        mediaStreamRef.current = stream;
        if (localVideoRef.current && callType === "video") {
          localVideoRef.current.srcObject = stream;
        }

        const pc = initPeerConnection(convId, callType);

        if (offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          while (queuedIceCandidatesRef.current.length > 0) {
            const cand = queuedIceCandidatesRef.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendCallSignal(convId, "call-accept", callType, answer);
        } else {
          await sendCallSignal(convId, "call-accept", callType);
        }
      }
    } catch (err) {
      console.warn("Could not access media devices on accept:", err);
      cleanupCall();
    }
  };

  const handleRejectIncomingCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    const convId = incomingCall.conversationId;
    const callType = incomingCall.callType;
    setIncomingCall(null);
    await sendCallSignal(convId, "call-reject", callType);
  };

  const handleToggleMute = () => {
    if (!activeCall) return;
    const nextMuted = !activeCall.isMuted;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setActiveCall((prev) => (prev ? { ...prev, isMuted: nextMuted } : null));
  };

  const handleToggleCamera = () => {
    if (!activeCall) return;
    const nextCam = !activeCall.isCameraOff;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextCam;
      });
    }
    setActiveCall((prev) => (prev ? { ...prev, isCameraOff: nextCam } : null));
  };

  const handleToggleScreenShare = async () => {
    if (!activeCall) return;
    try {
      if (!activeCall.isScreenSharing && navigator.mediaDevices?.getDisplayMedia) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        if (peerConnectionRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
        setActiveCall((prev) => (prev ? { ...prev, isScreenSharing: true } : null));
      } else {
        if (localVideoRef.current && mediaStreamRef.current) {
          localVideoRef.current.srcObject = mediaStreamRef.current;
        }
        if (peerConnectionRef.current && mediaStreamRef.current) {
          const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        }
        setActiveCall((prev) => (prev ? { ...prev, isScreenSharing: false } : null));
      }
    } catch {
      // Ignored
    }
  };

  const handleEndCall = async () => {
    if (!activeCall || !activeConvId) return;
    const duration = activeCall.durationSec;
    const callType = activeCall.type;

    stopRingtone();
    await sendCallSignal(activeConvId, "call-hangup", callType);

    const callMsg: ConnectMessage = {
      id: `m-call-${Date.now()}`,
      conversationId: activeConvId,
      senderId: authUser?.id || "user-current",
      senderName: authUser?.name || "Me",
      clientMsgId: `c-call-${Date.now()}`,
      type: "call",
      body: callType === "audio" ? "Audio Call" : "Video Call",
      callInfo: {
        type: callType,
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

    try {
      await fetch("/api/connect/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          type: callType.toUpperCase(),
          status: duration > 0 ? "COMPLETED" : "MISSED",
          durationSec: duration,
        }),
      });
    } catch {
      // Ignored
    }

    cleanupCall();
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const filteredEmployeesForDm = useMemo(() => {
    return directoryEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        e.department.toLowerCase().includes(directorySearch.toLowerCase()) ||
        e.designation.toLowerCase().includes(directorySearch.toLowerCase())
    );
  }, [directoryEmployees, directorySearch]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-surface text-ink antialiased">
      {/* Dedicated audio element for WebRTC remote audio playback in all calls */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="fixed -bottom-10 -right-10 size-1 opacity-0 pointer-events-none"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

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
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-ink-muted">
            Signed in as <strong>{authUser?.name || "ERP User"}</strong>
          </span>
        </div>
      </div>

      {/* Main 3-Pane Chat Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-line bg-surface">
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
                placeholder="Search conversations..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded border border-line bg-control/40 text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-ink-muted hover:text-ink cursor-pointer"
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
                  className={`px-2 py-0.5 rounded capitalize transition cursor-pointer ${
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
              <div className="p-8 text-center space-y-3">
                <div className="size-10 rounded-full bg-control/60 flex items-center justify-center mx-auto text-ink-muted">
                  <MessageSquarePlus className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-ink">No conversations yet</p>
                  <p className="text-[11px] text-ink-muted">
                    Start a direct message with a team member or create a channel.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsNewChatOpen(true)}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition cursor-pointer"
                  >
                    + Direct Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewGroupOpen(true)}
                    className="px-2.5 py-1 rounded border border-line bg-surface hover:bg-control text-ink text-[11px] font-medium transition cursor-pointer"
                  >
                    + Channel
                  </button>
                </div>
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
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-xs">
                          <Hash className="size-4" />
                        </div>
                      ) : (
                        <div
                          className={`flex size-9 items-center justify-center rounded-full font-bold text-xs ${getAvatarBg(
                            c.name
                          )}`}
                        >
                          {getInitials(c.name)}
                        </div>
                      )}
                    </div>

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
                        {c.lastMessage?.body || c.description || "No messages yet"}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        {c.isPinned && <Pin className="size-2.5 text-blue-600 rotate-45" />}
                        {c.isMuted && <BellOff className="size-2.5 text-ink-muted" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Center: Active Chat Stream or Empty State */}
        <main className="flex flex-1 flex-col overflow-hidden bg-surface">
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="size-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shadow-xs">
                <MessageSquarePlus className="size-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-ink">Welcome to BRG Connect</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Enterprise real-time communication platform integrated with BridgeOne ERP. Select an existing conversation or start collaborating with your team.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(true)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Plus className="size-4" />
                  <span>Start Direct Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsNewGroupOpen(true)}
                  className="px-4 py-2 rounded-lg border border-line bg-surface hover:bg-control text-ink text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                >
                  <Users className="size-4" />
                  <span>Create Team Channel</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Conversation Top Bar */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {activeConv.type === "group" ? (
                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-sm">
                      <Hash className="size-4" />
                    </div>
                  ) : (
                    <div
                      className={`flex size-9 items-center justify-center rounded-full font-bold text-xs ${getAvatarBg(
                        activeConv.name
                      )}`}
                    >
                      {getInitials(activeConv.name)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-ink truncate">{activeConv.name}</h3>
                      {activeConv.isMuted && <BellOff className="size-3 text-ink-muted" />}
                    </div>
                    <span className="text-[11px] text-ink-muted block truncate">
                      {activeConv.type === "group"
                        ? `${activeConv.description || "Team Channel"}`
                        : "Direct Message"}
                    </span>
                  </div>
                </div>

                {/* Call Actions */}
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
                {activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 text-ink-muted">
                    <p className="text-xs font-semibold text-ink">No messages yet in this conversation</p>
                    <p className="text-[11px]">Type a message below to start collaborating.</p>
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMe = msg.senderId === (authUser?.id || "user-current");
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {!isMe && (
                          <div
                            className={`size-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${getAvatarBg(
                              msg.senderName
                            )}`}
                          >
                            {getInitials(msg.senderName)}
                          </div>
                        )}

                        <div className={`max-w-[70%] space-y-1 ${isMe ? "items-end" : "items-start"}`}>
                          {!isMe && activeConv.type === "group" && (
                            <span className="text-[11px] font-bold text-ink-muted block pl-1">
                              {msg.senderName}
                            </span>
                          )}

                          <div
                            className={`relative rounded-xl p-3 text-xs leading-relaxed shadow-2xs ${
                              isMe
                                ? "bg-blue-600 text-white rounded-tr-xs"
                                : "bg-surface border border-line text-ink rounded-tl-xs"
                            }`}
                          >
                            {/* Quoted Reply */}
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
                                    className="px-2 py-0.5 rounded bg-control text-ink text-[11px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(msg.id)}
                                    className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.body}</p>
                            )}

                            {/* Live ERP Record */}
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
                                  <span className="text-[10px] opacity-75">Live ERP Record</span>
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
                                <a
                                  href={att.url}
                                  download={att.name}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="size-6 rounded hover:bg-surface/20 flex items-center justify-center transition cursor-pointer"
                                  title="Download attachment"
                                >
                                  <Download className="size-3.5" />
                                </a>
                              </div>
                            ))}

                            {/* Call Info */}
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

                          {/* Actions */}
                          <div
                            className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition px-1 ${
                              isMe ? "justify-end" : "justify-start"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setReplyingTo(msg)}
                              className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink cursor-pointer"
                              title="Reply"
                            >
                              <Reply className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(msg.body)}
                              className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink cursor-pointer"
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
                                  className="p-1 rounded hover:bg-control text-ink-muted hover:text-ink cursor-pointer"
                                  title="Edit message"
                                >
                                  <Edit2 className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 rounded hover:bg-control text-rose-500 hover:text-rose-700 cursor-pointer"
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
                  })
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
                    className="text-ink-muted hover:text-ink cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Bottom Message Composer */}
              <div className="p-3 border-t border-line bg-surface">
                <div className="flex items-end gap-2 rounded-lg border border-line bg-surface p-1.5 shadow-2xs focus-within:ring-1 focus-within:ring-blue-500">
                  <div className="flex items-center gap-1 text-ink-muted pb-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="size-7 rounded hover:bg-control flex items-center justify-center hover:text-ink transition cursor-pointer"
                      title="Upload & Attach File"
                    >
                      <Paperclip className={`size-4 ${isUploading ? "animate-spin text-blue-600" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsErpPickerOpen(true)}
                      className="size-7 rounded hover:bg-control flex items-center justify-center text-blue-600 hover:text-blue-700 transition cursor-pointer"
                      title="Attach Live ERP Record (PO, Requisition)"
                    >
                      <Share2 className="size-4" />
                    </button>
                  </div>

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

                  <div className="flex items-center gap-1 pb-1">
                    <button
                      type="button"
                      onClick={() => handleStartCall("audio")}
                      className="size-7 rounded hover:bg-control flex items-center justify-center text-ink-muted hover:text-ink transition cursor-pointer"
                      title="Voice Call"
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
            </>
          )}
        </main>

        {/* Right Pane: Conversation Details */}
        {isDetailsOpen && activeConv && (
          <aside className="w-72 shrink-0 border-l border-line bg-surface p-4 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Details</h3>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-center space-y-2">
              {activeConv.type === "group" ? (
                <div className="flex size-14 mx-auto items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xl">
                  <Hash className="size-7" />
                </div>
              ) : (
                <div
                  className={`flex size-14 mx-auto items-center justify-center rounded-full font-bold text-base ${getAvatarBg(
                    activeConv.name
                  )}`}
                >
                  {getInitials(activeConv.name)}
                </div>
              )}
              <h4 className="font-bold text-sm text-ink">{activeConv.name}</h4>
              <p className="text-xs text-ink-muted">{activeConv.description || "Active Conversation"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => handleStartCall("audio")}
                className="flex items-center justify-center gap-1.5 p-2 rounded border border-line bg-control/40 hover:bg-control text-ink transition cursor-pointer"
              >
                <Phone className="size-3.5 text-emerald-600" />
                <span>Audio Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall("video")}
                className="flex items-center justify-center gap-1.5 p-2 rounded border border-line bg-control/40 hover:bg-control text-ink transition cursor-pointer"
              >
                <Video className="size-3.5 text-blue-600" />
                <span>Video Call</span>
              </button>
            </div>

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
                className="w-full flex items-center justify-between p-2 rounded border border-line bg-control/30 text-ink hover:bg-control transition cursor-pointer"
              >
                <span>Mute Notifications</span>
                {activeConv.isMuted ? <BellOff className="size-3.5 text-amber-500" /> : <Bell className="size-3.5" />}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Incoming Call Alert Modal */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-white text-center shadow-2xl space-y-6">
            <div className="relative size-24 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div
                className={`relative size-20 rounded-full flex items-center justify-center font-bold text-2xl border-4 border-emerald-500 shadow-xl ${getAvatarBg(
                  incomingCall.callerName
                )}`}
              >
                {getInitials(incomingCall.callerName)}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">{incomingCall.callerName}</h3>
              <p className="text-xs text-emerald-400 font-medium animate-pulse">
                Incoming {incomingCall.callType === "video" ? "Video" : "Audio"} Call...
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={handleRejectIncomingCall}
                className="size-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer"
                title="Decline"
              >
                <PhoneOff className="size-6" />
              </button>

              <button
                type="button"
                onClick={handleAcceptIncomingCall}
                className="size-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer"
                title="Accept"
              >
                <Phone className="size-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real WebRTC Call Modal with Camera / Screen Share */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 text-white text-center shadow-2xl space-y-6">
            <div className="space-y-2">
              <div
                className={`size-20 mx-auto rounded-full flex items-center justify-center font-bold text-xl border-4 border-slate-700 ${getAvatarBg(
                  activeConv?.name || "Colleague"
                )}`}
              >
                {getInitials(activeConv?.name || "Colleague")}
              </div>
              <h3 className="font-bold text-lg">{activeConv?.name || "Colleague"}</h3>
              <p className="text-xs text-slate-400">
                {activeCall.status === "ringing"
                  ? "Ringing WebRTC Peer (Google STUN active)..."
                  : `Connected • ${formatTime(activeCall.durationSec)}`}
              </p>
            </div>

            {activeCall.type === "video" && (
              <div className="relative h-64 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 overflow-hidden shadow-inner">
                {/* Main Remote Video Stream */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Picture-in-Picture Local Video Inset */}
                <div className="absolute bottom-3 right-3 w-32 h-24 rounded-lg overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${activeCall.isCameraOff ? "hidden" : "block"}`}
                  />
                  {activeCall.isCameraOff && (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                      Camera Off
                    </div>
                  )}
                </div>

                {activeCall.isScreenSharing && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-semibold flex items-center gap-1">
                    <Monitor className="size-3" />
                    <span>Sharing Screen</span>
                  </span>
                )}
              </div>
            )}

            {activeCall.type === "audio" && activeCall.status === "connected" && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-1.5 h-10">
                  {[40, 75, 50, 90, 60, 30, 80, 55].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}%` }}
                      className="w-1.5 rounded-full bg-emerald-400 animate-pulse"
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>{activeCall.isMuted ? "Microphone Muted" : "Voice Live & Bidirectional"}</span>
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`size-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                  activeCall.isMuted ? "bg-rose-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
                title={activeCall.isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {activeCall.isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>

              {activeCall.type === "video" && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`size-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                      activeCall.isCameraOff ? "bg-rose-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                    }`}
                    title={activeCall.isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
                  >
                    {activeCall.isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleScreenShare}
                    className={`size-12 rounded-full flex items-center justify-center transition cursor-pointer ${
                      activeCall.isScreenSharing ? "bg-blue-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                    }`}
                    title={activeCall.isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                  >
                    <Monitor className="size-5" />
                  </button>
                </>
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

      {/* Real ERP Record Picker Modal */}
      {isErpPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-blue-600" />
                <h3 className="font-bold text-sm">Attach Live ERP Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsErpPickerOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-ink-muted">
              Select an active Purchase Order or Requisition from the database:
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {realErpRecords.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-muted">
                  No active ERP purchase orders or requisitions found in database.
                </div>
              ) : (
                realErpRecords.map((card) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Direct Chat Modal (With real employees from DB) */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-bold text-sm">Start Direct Message</h3>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-ink-muted" />
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Search employee by name, department..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded border border-line bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {filteredEmployeesForDm.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-muted">
                  No matching employees found in database.
                </div>
              ) : (
                filteredEmployeesForDm.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={async () => {
                      const existing = conversations.find(
                        (c) => c.type === "direct" && c.name === emp.name
                      );
                      if (existing) {
                        setActiveConvId(existing.id);
                      } else {
                        try {
                          const res = await fetch("/api/connect/conversations", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: "DIRECT",
                              name: emp.name,
                              description: `${emp.designation} • ${emp.department}`,
                              memberUserIds: [authUser?.id || "user-current", emp.id],
                            }),
                          });
                          const data = await res.json();
                          if (data.success && data.conversation) {
                            const newC: ConnectConversation = {
                              id: data.conversation.id,
                              type: "direct",
                              name: emp.name,
                              description: `${emp.designation} • ${emp.department}`,
                              department: emp.department,
                              members: [authUser?.id || "user-current", emp.id],
                              unreadCount: 0,
                              createdAt: data.conversation.created_at,
                            };
                            setConversations((prev) => [newC, ...prev]);
                            setActiveConvId(data.conversation.id);
                          }
                        } catch {
                          // Fallback
                        }
                      }
                      setIsNewChatOpen(false);
                      setDirectorySearch("");
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-line bg-control/20 hover:bg-control transition cursor-pointer"
                  >
                    <div
                      className={`size-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarBg(
                        emp.name
                      )}`}
                    >
                      {getInitials(emp.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-medium text-xs text-ink truncate">{emp.name}</span>
                      <span className="text-[11px] text-ink-muted truncate block">
                        {emp.designation} • {emp.department}
                      </span>
                    </div>
                    <span className="size-2 rounded-full bg-emerald-500" />
                  </div>
                ))
              )}
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
                className="text-ink-muted hover:text-ink cursor-pointer"
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
                    placeholder="e.g. procurement-approvals"
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
                  placeholder="Channel purpose"
                  className="w-full h-8 px-2.5 rounded border border-line bg-surface text-ink text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">Select Members</label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded p-2 bg-control/20">
                  {directoryEmployees.map((emp) => {
                    const isSelected = selectedGroupMembers.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedGroupMembers((prev) =>
                            isSelected ? prev.filter((id) => id !== emp.id) : [...prev, emp.id]
                          );
                        }}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer text-xs ${
                          isSelected ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold" : "hover:bg-control"
                        }`}
                      >
                        <span>{emp.name} ({emp.department})</span>
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
                className="px-3 py-1.5 rounded border border-line text-xs text-ink hover:bg-control cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newGroupName.trim()}
                onClick={async () => {
                  const channelName = newGroupName.startsWith("#") ? newGroupName : `#${newGroupName}`;
                  try {
                    const res = await fetch("/api/connect/conversations", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        type: "GROUP",
                        name: channelName,
                        description: newGroupDesc || "Team Channel",
                        memberUserIds: [authUser?.id || "user-current", ...selectedGroupMembers],
                      }),
                    });
                    const data = await res.json();
                    if (data.success && data.conversation) {
                      const newC: ConnectConversation = {
                        id: data.conversation.id,
                        type: "group",
                        name: channelName,
                        description: newGroupDesc || "Team Channel",
                        members: [authUser?.id || "user-current", ...selectedGroupMembers],
                        unreadCount: 0,
                        createdAt: data.conversation.created_at,
                      };
                      setConversations((prev) => [newC, ...prev]);
                      setActiveConvId(data.conversation.id);
                    }
                  } catch {
                    // Fallback
                  }
                  setIsNewGroupOpen(false);
                  setNewGroupName("");
                  setNewGroupDesc("");
                  setSelectedGroupMembers([]);
                }}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
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
