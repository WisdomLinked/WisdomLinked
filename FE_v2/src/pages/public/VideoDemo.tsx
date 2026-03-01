/** VideoDemo — public video call demo page. Route: /demo/video */
import "@livekit/components-styles";

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
import { ArrowLeft, Check, Copy, Link, Loader2, UserRound, Video } from "lucide-react";
import { Track } from "livekit-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFrontendEnvironmentConfig } from "@/config/env";

const LIVEKIT_SERVER_URL = "wss://livekit.authentive.io";

type Phase =
  | { kind: "prejoin"; error: string | null }
  | { kind: "joining" }
  | { kind: "incall"; token: string };

function getInitialRoomName(): string {
  const p = new URLSearchParams(window.location.search).get("room");
  return p !== null && p.trim().length > 0 ? p.trim() : `demo-${Math.random().toString(36).slice(2, 8)}`;
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
    const res = await fetch(`${apiBaseUrl}/api/v1/demo/video-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, participantName }),
    });
    if (res.status === 503) return { error: "Video service is not configured on the server." };
    if (!res.ok) return { error: `Failed to connect (HTTP ${res.status}). Please try again.` };
    const raw: unknown = await res.json();
    const token = extractToken(raw);
    if (token === null) return { error: "Unexpected response from video server." };
    return { token };
  } catch {
    return { error: "Network error — could not reach the video service. Please try again." };
  }
}

function VideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <div className="flex-1 overflow-hidden">
      <GridLayout tracks={tracks} className="h-full"><ParticipantTile /></GridLayout>
    </div>
  );
}

function RoomStatusBar({ roomName, onLeave }: { roomName: string; onLeave: () => void }) {
  const participants = useParticipants();
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b bg-card px-4 h-14">
      <Button variant="ghost" size="sm" onClick={onLeave}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
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

function InCallView({ token, roomName, onLeave }: { token: string; roomName: string; onLeave: () => void }) {
  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      <LiveKitRoom
        serverUrl={LIVEKIT_SERVER_URL}
        token={token}
        onDisconnected={onLeave}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <RoomStatusBar roomName={roomName} onLeave={onLeave} />
        <VideoConference />
        <RoomAudioRenderer />
        <ControlBar />
      </LiveKitRoom>
    </div>
  );
}

function CopyLinkRow({ roomName }: { roomName: string }) {
  const [copied, setCopied] = useState(false);
  const trimmed = roomName.trim();
  if (trimmed.length === 0) return null;

  const url = `${window.location.origin}/demo/video?room=${encodeURIComponent(trimmed)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in this context — noop
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <Link className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-xs text-muted-foreground">{url}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="flex flex-shrink-0 items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
        aria-label="Copy shareable link"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span>{copied ? "Copied!" : "Copy"}</span>
      </button>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <UserRound className="h-4 w-4 text-primary" /><span>Enter your name</span>
      <span className="mx-2 opacity-30">→</span>
      <Link className="h-4 w-4 text-primary" /><span>Share the link</span>
      <span className="mx-2 opacity-30">→</span>
      <Video className="h-4 w-4 text-primary" /><span>Start your call</span>
    </div>
  );
}

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
    <div
      className="flex flex-col items-center justify-center px-4 py-6 overflow-y-auto"
      style={{
        height: "100dvh",
        background:
          "radial-gradient(ellipse 80% 40% at 50% -10%, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
      }}
    >
      <div className="mb-4 space-y-2 text-center">
        <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
          <Video className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Try a Live Video Call</h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">No account needed. Enter your name, share the room link, and start talking.</p>
      </div>

      <div className="glass w-full max-w-md space-y-4 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-2xl">
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
          <CopyLinkRow roomName={roomName} />
        </div>

        {error !== null && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button className="w-full" size="lg" onClick={onJoin} disabled={!canJoin}>
          {isJoining ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            "Join Room →"
          )}
        </Button>
      </div>

      <HowItWorks />
    </div>
  );
}

export default function VideoDemo() {
  const [participantName, setParticipantName] = useState("");
  const [roomName, setRoomName] = useState<string>(getInitialRoomName);
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

  const handleLeave = () => setPhase({ kind: "prejoin", error: null });

  if (phase.kind === "incall") {
    return <InCallView token={phase.token} roomName={roomName.trim()} onLeave={handleLeave} />;
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
