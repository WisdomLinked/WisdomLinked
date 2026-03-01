/**
 * VideoDemo — public, unauthenticated video call demo page.
 *
 * Route: /demo/video
 *
 * Behaviour:
 *  1. Pre-join form: enter name + room name, then click "Join Room".
 *  2. Token is fetched from POST /api/v1/demo/video-token (no auth required).
 *  3. On success: renders a LiveKit room with video/audio controls.
 *  4. "Leave" button returns to the pre-join form.
 *  5. Errors (including 503 if LiveKit is not configured) are shown inline.
 */

import { useState } from "react";

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { ArrowLeft, Video } from "lucide-react";
import { Track } from "livekit-client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFrontendEnvironmentConfig } from "@/config/env";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIVEKIT_SERVER_URL = "wss://livekit.authentive.io";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { kind: "prejoin"; error: string | null }
  | { kind: "joining" }
  | { kind: "incall"; token: string };

// ── Pure helpers ──────────────────────────────────────────────────────────────

function generateDefaultRoomName(): string {
  return `demo-${Math.random().toString(36).slice(2, 8)}`;
}

function extractToken(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  return typeof obj["token"] === "string" ? obj["token"] : null;
}

async function fetchDemoToken(
  apiBaseUrl: string,
  roomName: string,
  participantName: string,
): Promise<{ token: string } | { error: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/demo/video-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, participantName }),
    });

    if (response.status === 503) {
      return { error: "Video service is not configured on the server." };
    }
    if (!response.ok) {
      return { error: `Failed to connect (HTTP ${response.status}). Please try again.` };
    }

    const raw: unknown = await response.json();
    const token = extractToken(raw);
    if (token === null) {
      return { error: "Unexpected response from video server." };
    }
    return { token };
  } catch {
    return { error: "Network error — could not reach the video service. Please try again." };
  }
}

// ── VideoConference — renders the participant grid (must be inside LiveKitRoom) ─

function VideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex-1 overflow-hidden bg-background">
      <GridLayout tracks={tracks} className="h-full">
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

// ── RoomStatusBar — top bar rendered inside LiveKitRoom context ───────────────

interface RoomStatusBarProps {
  roomName: string;
  onLeave: () => void;
}

function RoomStatusBar({ roomName, onLeave }: RoomStatusBarProps) {
  const participants = useParticipants();

  return (
    <div className="flex items-center justify-between px-4 h-14 border-b bg-card flex-shrink-0">
      <Button variant="ghost" size="sm" onClick={onLeave}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Leave
      </Button>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{roomName}</span>
        <span className="text-muted-foreground">{participants.length} participant(s)</span>
      </div>
      <div className="w-20" />
    </div>
  );
}

// ── InCallView — the full-screen LiveKit room ─────────────────────────────────

interface InCallViewProps {
  token: string;
  roomName: string;
  onLeave: () => void;
}

function InCallView({ token, roomName, onLeave }: InCallViewProps) {
  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 8rem)" }}>
      <LiveKitRoom
        serverUrl={LIVEKIT_SERVER_URL}
        token={token}
        onDisconnected={onLeave}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <RoomStatusBar roomName={roomName} onLeave={onLeave} />
        <VideoConference />
        <RoomAudioRenderer />
        <ControlBar />
      </LiveKitRoom>
    </div>
  );
}

// ── PrejoinForm ───────────────────────────────────────────────────────────────

interface PrejoinFormProps {
  participantName: string;
  roomName: string;
  isJoining: boolean;
  error: string | null;
  onParticipantNameChange: (v: string) => void;
  onRoomNameChange: (v: string) => void;
  onJoin: () => void;
}

function PrejoinForm({
  participantName,
  roomName,
  isJoining,
  error,
  onParticipantNameChange,
  onRoomNameChange,
  onJoin,
}: PrejoinFormProps) {
  const canJoin = participantName.trim().length > 0 && roomName.trim().length > 0 && !isJoining;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canJoin) onJoin();
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Video className="h-6 w-6 text-primary" />
            Video Call Demo
          </CardTitle>
          <CardDescription>No account required — just enter your name and join.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="participant-name">Your Name</Label>
            <Input
              id="participant-name"
              placeholder="e.g. Alice"
              value={participantName}
              onChange={(e) => onParticipantNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isJoining}
              maxLength={64}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              placeholder="e.g. demo-abc123"
              value={roomName}
              onChange={(e) => onRoomNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isJoining}
              maxLength={64}
            />
            <p className="text-xs text-muted-foreground">
              Share this room name with others to join the same call.
            </p>
          </div>

          {error !== null && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button className="w-full" onClick={onJoin} disabled={!canJoin}>
            {isJoining ? "Connecting…" : "Join Room"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main VideoDemo page ───────────────────────────────────────────────────────

export default function VideoDemo() {
  const [participantName, setParticipantName] = useState("");
  const [roomName, setRoomName] = useState<string>(generateDefaultRoomName);
  const [phase, setPhase] = useState<Phase>({ kind: "prejoin", error: null });

  const handleJoin = async () => {
    const name = participantName.trim();
    const room = roomName.trim();
    if (!name || !room) return;

    setPhase({ kind: "joining" });

    const { apiBaseUrl } = getFrontendEnvironmentConfig();
    const result = await fetchDemoToken(apiBaseUrl, room, name);

    if ("error" in result) {
      setPhase({ kind: "prejoin", error: result.error });
    } else {
      setPhase({ kind: "incall", token: result.token });
    }
  };

  const handleLeave = () => {
    setPhase({ kind: "prejoin", error: null });
  };

  if (phase.kind === "incall") {
    return (
      <InCallView token={phase.token} roomName={roomName.trim()} onLeave={handleLeave} />
    );
  }

  return (
    <PrejoinForm
      participantName={participantName}
      roomName={roomName}
      isJoining={phase.kind === "joining"}
      error={phase.kind === "prejoin" ? phase.error : null}
      onParticipantNameChange={setParticipantName}
      onRoomNameChange={setRoomName}
      onJoin={handleJoin}
    />
  );
}
