"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle,
  Code2,
  Database,
  Network,
  Radio,
  Server,
  Terminal,
  Zap,
} from "lucide-react";

export default function BrgConnectDocsPage() {
  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/connect"
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              &larr; Back to Chat
            </Link>
          </div>
          <h1 className="text-xl font-bold text-ink mt-1 flex items-center gap-2">
            <Code2 className="size-5 text-blue-600" />
            <span>BRG Connect — System Architecture &amp; Engineering Spec</span>
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Production design for REST API, WebSocket Gateway, Redis Pub/Sub, S3/MinIO, and WebRTC Coturn audio/video.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/connect"
            className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Radio className="size-3.5" />
            <span>Open Live Messenger</span>
          </Link>
        </div>
      </div>

      {/* 1. Core Architecture Topology Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink flex items-center gap-2">
          <Server className="size-4 text-blue-600" />
          <span>1. Infrastructure &amp; Multi-Tier Topology</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-line bg-surface space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs">
              <Zap className="size-4" />
              <span>WebSocket Gateway (WSS)</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Full-duplex gateway cluster (Node.js / Socket.IO / uWebSockets). Handles instant message fanout, typing events, seen status, and WebRTC SDP signaling without HTTP polling overhead.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-line bg-surface space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs">
              <Database className="size-4" />
              <span>Redis Pub/Sub &amp; Presence Set</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Sub-millisecond pub/sub broadcast across multiple server nodes. Tracks live employee online status, ephemeral typing states, unread counters, and WebSocket connection heartbeats.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-line bg-surface space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs">
              <Radio className="size-4" />
              <span>WebRTC &amp; Coturn (STUN/TURN)</span>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Mandatory Coturn TURN relay server for corporate firewalls, NATs, and mobile telco networks in Bangladesh. 1-to-1 P2P encrypted media with fallback to LiveKit SFU for multi-party calls.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Message Delivery Protocol (Sequence) */}
      <div className="rounded-xl border border-line bg-surface p-5 space-y-4 shadow-2xs">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink flex items-center gap-2">
          <Network className="size-4 text-blue-600" />
          <span>2. End-to-End Message Delivery Protocol (Client Msg ID &amp; Acks)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-line bg-control/30 space-y-1">
            <span className="font-bold text-ink block">Step 1: Optimistic Bubble</span>
            <p className="text-ink-muted">Client generates UUIDv4 <code className="font-mono text-blue-600">client_msg_id</code> and renders bubble instantly with clock icon (🕒).</p>
          </div>
          <div className="p-3 rounded-lg border border-line bg-control/30 space-y-1">
            <span className="font-bold text-ink block">Step 2: Server Ack (Sent ✓)</span>
            <p className="text-ink-muted">Server validates auth, writes to Postgres, and sends back <code className="font-mono text-blue-600">chat:ack</code>. UI updates to single tick (✓).</p>
          </div>
          <div className="p-3 rounded-lg border border-line bg-control/30 space-y-1">
            <span className="font-bold text-ink block">Step 3: Delivered (✓✓)</span>
            <p className="text-ink-muted">Message dispatched via Redis pub/sub to recipient gateway. Recipient device emits delivery receipt (✓✓).</p>
          </div>
          <div className="p-3 rounded-lg border border-line bg-control/30 space-y-1">
            <span className="font-bold text-ink block">Step 4: Seen (✓✓ Blue)</span>
            <p className="text-ink-muted">When recipient views thread, <code className="font-mono text-blue-600">last_read_message_id</code> updates in DB and broadcasted via WebSocket.</p>
          </div>
        </div>
      </div>

      {/* 3. WebSocket Event Reference Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink flex items-center gap-2">
          <Terminal className="size-4 text-blue-600" />
          <span>3. WebSocket Gateway Event Schema Specification</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead className="bg-[#e0f2fe]/80 dark:bg-sky-950/40 text-slate-800 dark:text-slate-200 border-b border-line">
              <tr>
                <th className="p-2.5">Event Name</th>
                <th className="p-2.5">Direction</th>
                <th className="p-2.5">Payload Format</th>
                <th className="p-2.5">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 font-mono text-[11px]">
              <tr>
                <td className="p-2.5 font-bold text-blue-600">auth</td>
                <td className="p-2.5 text-slate-500">Client &rarr; Server</td>
                <td className="p-2.5 text-ink">{`{ token: "Bearer <ERP_JWT>" }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Authenticates socket with ERP session</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">chat:send</td>
                <td className="p-2.5 text-slate-500">Client &rarr; Server</td>
                <td className="p-2.5 text-ink">{`{ clientMsgId, convId, body, type }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Sends chat message with idempotency key</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">chat:ack</td>
                <td className="p-2.5 text-emerald-600">Server &rarr; Client</td>
                <td className="p-2.5 text-ink">{`{ clientMsgId, serverId, createdAt }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Confirms message persistence in database</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">chat:seen</td>
                <td className="p-2.5 text-slate-500">Client &rarr; Server</td>
                <td className="p-2.5 text-ink">{`{ convId, lastReadMessageId }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Updates user read marker (lean unread count)</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">chat:typing</td>
                <td className="p-2.5 text-slate-500">Bidirectional</td>
                <td className="p-2.5 text-ink">{`{ convId, isTyping: true }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Broadcasts ephemeral typing indicator</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">call:invite</td>
                <td className="p-2.5 text-slate-500">Bidirectional</td>
                <td className="p-2.5 text-ink">{`{ convId, type: "audio" | "video" }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Initiates WebRTC session signaling</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-blue-600">call:signal</td>
                <td className="p-2.5 text-slate-500">Bidirectional</td>
                <td className="p-2.5 text-ink">{`{ callId, sdp?, candidate? }`}</td>
                <td className="p-2.5 text-ink-muted font-sans text-xs">Exchanges SDP Offer/Answer and ICE candidates</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Database Schema Preview */}
      <div className="rounded-xl border border-line bg-surface p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink flex items-center gap-2">
            <Database className="size-4 text-blue-600" />
            <span>4. Production Prisma Schema (PostgreSQL)</span>
          </h2>
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle className="size-3.5" />
            <span>Validated in schema.prisma</span>
          </span>
        </div>

        <p className="text-xs text-ink-muted">
          All 6 tables (<code className="font-mono text-ink font-semibold">connect_conversations</code>, <code className="font-mono text-ink font-semibold">connect_conversation_members</code>, <code className="font-mono text-ink font-semibold">connect_messages</code>, <code className="font-mono text-ink font-semibold">connect_attachments</code>, <code className="font-mono text-ink font-semibold">connect_calls</code>, <code className="font-mono text-ink font-semibold">connect_call_participants</code>) are active in the project&apos;s Prisma schema.
        </p>

        <div className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-[11px] leading-relaxed overflow-x-auto">
          <pre>{`model ConnectConversation {
  id          String                  @id @default(uuid()) @db.Uuid
  type        ConnectConversationType @default(DIRECT)
  name        String?                 @db.VarChar(150)
  description String?                 @db.VarChar(500)
  members     ConnectConversationMember[]
  messages    ConnectMessage[]
  calls       ConnectCall[]
}

model ConnectConversationMember {
  id                String            @id @default(uuid()) @db.Uuid
  conversationId    String            @db.Uuid
  userId            String            @db.Uuid
  role              ConnectMemberRole @default(MEMBER)
  lastReadMessageId String?           @db.Uuid
  isMuted           Boolean           @default(false)
}

model ConnectMessage {
  id             String             @id @default(uuid()) @db.Uuid
  conversationId String             @db.Uuid
  senderId       String             @db.Uuid
  clientMsgId    String?            @db.VarChar(64)
  type           ConnectMessageType @default(TEXT)
  body           String             @db.Text
  erpRecordType  String?            @db.VarChar(50)
  erpRecordId    String?            @db.VarChar(100)
  erpRecordData  Json?
  attachments    ConnectAttachment[]
}`}</pre>
        </div>
      </div>
    </div>
  );
}
