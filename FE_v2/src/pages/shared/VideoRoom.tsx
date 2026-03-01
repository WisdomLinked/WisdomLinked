/**
 * VideoRoom — LiveKit-powered video call room.
 *
 * Route: /dashboard/video/:roomId
 *
 * Behaviour:
 *  1. Fetch event context from eventsApi.getEvent(roomId) for display.
 *  2. Fetch a LiveKit room token from useLiveKitRoom(roomId).
 *  3. If token is available → render <LiveKitRoom> with full AV controls.
 *  4. If token endpoint is not configured → render a clean placeholder card
 *     that shows event info and a "not yet available" notice.
 *
 * LiveKit server: wss://livekit.authentive.io
 * Token backend endpoint: POST /api/v1/video/token  (to be wired up)
 */

import { useEffect, useState } from "react";

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { ArrowLeft, Info, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Track } from "livekit-client";
import { useNavigate, useParams } from "react-router-dom";

import { eventsApi, type Event } from "@/api/eventsApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIVEKIT_SERVER_URL = "wss://livekit.authentive.io";

// ── Video conference sub-component (must be inside <LiveKitRoom> context) ─────

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

// ── Event info card (used in both live and placeholder views) ─────────────────

interface EventInfoProps {
  event: Event | null;
  roomId: string;
}

function EventInfo({ event, roomId }: EventInfoProps) {
  if (event === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 flex-shrink-0" />
        <span>Room: {roomId}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="font-medium">{event.title ?? `Session #${event.id.slice(-6)}`}</span>
      <Badge variant="secondary" className="capitalize">
        {event.status}
      </Badge>
      <span className="text-muted-foreground">
        {event.expert.username} &amp; {event.customer.username}
      </span>
    </div>
  );
}

// ── Placeholder view (shown when token endpoint is not yet configured) ────────

interface PlaceholderViewProps {
  event: Event | null;
  eventLoading: boolean;
  roomId: string;
  tokenError: string | null;
  onLeave: () => void;
}

function PlaceholderView({
  event,
  eventLoading,
  roomId,
  tokenError,
  onLeave,
}: PlaceholderViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Video Room
          </CardTitle>

          {/* Event context */}
          {eventLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : (
            <EventInfo event={event} roomId={roomId} />
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Status notice */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">
              Video call is not yet available
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {tokenError !== null ? tokenError : "Connecting to video service…"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The LiveKit token endpoint (<code className="font-mono text-xs">POST /api/v1/video/token</code>) needs to
              be configured on the backend. Once wired, video calls will work
              automatically with the server at{" "}
              <code className="font-mono text-xs">{LIVEKIT_SERVER_URL}</code>.
            </p>
          </div>

          {/* Disabled controls preview */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" disabled aria-label="Mute audio">
              <Mic className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" disabled aria-label="Disable video">
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              Join Call
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onLeave}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Live room view ────────────────────────────────────────────────────────────

interface LiveRoomViewProps {
  token: string;
  event: Event | null;
  roomId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
}

function LiveRoomView({
  token,
  event,
  roomId,
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
}: LiveRoomViewProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-14 border-b bg-card flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLeave}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Leave
        </Button>

        <EventInfo event={event} roomId={roomId} />

        <div className="flex items-center gap-2">
          <Button
            variant={audioEnabled ? "outline" : "secondary"}
            size="icon"
            onClick={onToggleAudio}
            aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {audioEnabled ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant={videoEnabled ? "outline" : "secondary"}
            size="icon"
            onClick={onToggleVideo}
            aria-label={videoEnabled ? "Disable camera" : "Enable camera"}
          >
            {videoEnabled ? (
              <Video className="h-4 w-4" />
            ) : (
              <VideoOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* LiveKit room */}
      <LiveKitRoom
        serverUrl={LIVEKIT_SERVER_URL}
        token={token}
        video={videoEnabled}
        audio={audioEnabled}
        onDisconnected={() => {
          onLeave();
        }}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <VideoConference />
        <RoomAudioRenderer />
        <ControlBar />
      </LiveKitRoom>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function VideoRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const safeRoomId = roomId ?? "";

  // Event context
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  // AV state (used in live room top bar)
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // LiveKit token
  const { token, loading: tokenLoading, error: tokenError } = useLiveKitRoom(safeRoomId);

  // Fetch event details for context display
  useEffect(() => {
    if (safeRoomId === "") {
      setEventLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await eventsApi.getEvent(safeRoomId);
        if (!cancelled) {
          setEvent(res.event);
        }
      } catch {
        // Event may not exist for this roomId — silently ignore
      } finally {
        if (!cancelled) {
          setEventLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [safeRoomId]);

  const handleLeave = () => {
    navigate(-1);
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (tokenLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Connecting to Video Room…
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Live room ─────────────────────────────────────────────────────────────

  if (token !== null) {
    return (
      <LiveRoomView
        token={token}
        event={event}
        roomId={safeRoomId}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={() => {
          setAudioEnabled((prev) => !prev);
        }}
        onToggleVideo={() => {
          setVideoEnabled((prev) => !prev);
        }}
        onLeave={handleLeave}
      />
    );
  }

  // ── Placeholder view ──────────────────────────────────────────────────────

  return (
    <PlaceholderView
      event={event}
      eventLoading={eventLoading}
      roomId={safeRoomId}
      tokenError={tokenError}
      onLeave={handleLeave}
    />
  );
}
