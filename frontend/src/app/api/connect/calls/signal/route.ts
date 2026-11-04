import { NextResponse } from "next/server";
import { getPusherServer } from "@/lib/connect/pusher-server";
import { getConnectAuthUser } from "@/lib/connect/auth";

export async function POST(req: Request) {
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

    const signalPayload = {
      conversationId,
      senderId: user.id,
      senderName: user.name,
      type, // 'call-request' | 'call-accept' | 'call-reject' | 'call-hangup' | 'webrtc-offer' | 'webrtc-answer' | 'ice-candidate'
      callType: callType || "audio",
      sdp: sdp || null,
      candidate: candidate || null,
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
