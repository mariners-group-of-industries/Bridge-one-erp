import { NextResponse } from "next/server";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { getConnectAuthUser } from "@/lib/connect/auth";
import { connectRoute } from "@/lib/connect/route";

// In-memory cache for large WebRTC SDP payloads to protect against Pusher 10KB message limits
interface CachedSdp {
  sdp: RTCSessionDescriptionInit;
  type: string;
  senderId: string;
  timestamp: number;
}

const sdpStore = new Map<string, CachedSdp>();

async function handleGET(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "conversationId is required" },
        { status: 400 }
      );
    }

    const cached = sdpStore.get(conversationId);
    if (!cached || Date.now() - cached.timestamp > 120000) {
      return NextResponse.json(
        { success: false, error: "No active SDP session description found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sdp: cached.sdp,
      type: cached.type,
      senderId: cached.senderId,
    });
  } catch (error) {
    console.error("Error retrieving WebRTC call SDP:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve SDP" },
      { status: 500 }
    );
  }
}

async function handlePOST(req: Request) {
  try {
    const user = await getConnectAuthUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      conversationId,
      type,
      callType,
      sdp,
      candidate,
    } = body;

    if (!conversationId || !type) {
      return NextResponse.json(
        { success: false, error: "conversationId and type are required" },
        { status: 400 }
      );
    }

    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json(
        { success: false, error: "Pusher service unavailable" },
        { status: 503 }
      );
    }

    // Cache SDP on the server whenever present
    if (sdp) {
      sdpStore.set(conversationId, {
        sdp,
        type,
        senderId: user.id,
        timestamp: Date.now(),
      });
    }

    let payloadSdp = sdp || null;
    let hasRemoteSdp = false;

    // Check payload size against Pusher's 10,240 byte ceiling
    const tempPayload = {
      conversationId,
      senderId: user.id,
      senderName: user.name,
      type,
      callType: callType || "audio",
      sdp: payloadSdp,
      candidate: candidate || null,
      hasRemoteSdp: false,
      timestamp: Date.now(),
    };

    if (JSON.stringify(tempPayload).length > 8000) {
      payloadSdp = null;
      hasRemoteSdp = true;
    }

    const signalPayload = {
      conversationId,
      senderId: user.id,
      senderName: user.name,
      type, // 'call-request' | 'call-accept' | 'call-reject' | 'call-hangup' | 'webrtc-offer' | 'webrtc-answer' | 'ice-candidate'
      callType: callType || "audio",
      sdp: payloadSdp,
      candidate: candidate || null,
      hasRemoteSdp,
      timestamp: Date.now(),
    };

    // Broadcast signaling event over Pusher channels
    await pusher.trigger([`chat-${conversationId}`, "connect-global"], "call-signal", signalPayload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error broadcasting WebRTC call signal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to broadcast signal" },
      { status: 500 }
    );
  }
}

export const GET = connectRoute("employees:read", handleGET);
export const POST = connectRoute("configuration:write", handlePOST);
