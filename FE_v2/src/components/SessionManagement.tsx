import { useState, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { sessionsAtom } from "@/atoms/authAtoms";
import { sessionApi } from "@/api/sessionApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Monitor, Smartphone, Tablet, MapPin, Clock, XCircle, AlertTriangle, Calendar } from "lucide-react";
import { formatRelativeTime } from "@/utils/timeUtils";

export function SessionManagement() {
  const [sessions, setSessions] = useAtom(sessionsAtom);
  const [loading, setLoading] = useState(true);
  const [, setCurrentTime] = useState(new Date());

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await sessionApi.getMySessions();
      setSessions(response.sessions); // Automatically syncs to localStorage
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  }, [setSessions]);

  useEffect(() => {
    // Fetch fresh sessions from API
    fetchSessions();
    
    // Update relative times every 10 seconds
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to revoke this session? You will be logged out on that device.")) {
      return;
    }

    try {
      await sessionApi.revokeSession(sessionId);
      fetchSessions();
      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Session revoked successfully",
        });
      }
    } catch (error) {
      console.error("Failed to revoke session:", error);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm("Are you sure you want to revoke all other sessions? You will be logged out on all other devices.")) {
      return;
    }

    try {
      const response = await sessionApi.revokeAllSessions();
      fetchSessions();
      if (window.toast) {
        window.toast({
          title: "Success",
          description: `${response.count} session(s) revoked`,
        });
      }
    } catch (error) {
      console.error("Failed to revoke sessions:", error);
    }
  };

  const getDeviceIcon = (device?: string) => {
    switch (device?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-5 w-5" />;
      case "tablet":
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Active Sessions ({sessions.length})</h3>
          <p className="text-sm text-muted-foreground">
            Manage your active login sessions across devices
          </p>
        </div>
        {sessions.filter((s) => !s.isCurrent).length > 0 && (
          <Button variant="destructive" onClick={handleRevokeAllOthers}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Revoke All Others
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`border rounded-lg p-4 ${
                  session.isCurrent ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="mt-1 text-muted-foreground">
                      {getDeviceIcon(session.deviceInfo.device)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {session.deviceInfo.browser || "Unknown Browser"} on{" "}
                            {session.deviceInfo.os || "Unknown OS"}
                          </h3>
                          {session.isCurrent && (
                            <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary">
                              Current Session
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {session.deviceInfo.device || "Desktop"}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">IP:</span>
                          <span className="font-medium">{session.ipAddress}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Last active:</span>
                          <span className="font-medium">
                            {formatRelativeTime(session.lastActivity)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">
                            {formatRelativeTime(session.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground pt-1">
                        <div>
                          Last activity: {new Date(session.lastActivity).toLocaleString()}
                        </div>
                        <div>
                          Created: {new Date(session.createdAt).toLocaleString()} • Expires:{" "}
                          {new Date(session.expiresAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No active sessions
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• Revoke sessions from devices you don't recognize</p>
          <p>• Password changes automatically log out all sessions</p>
          <p>• Sessions expire automatically after 7 days</p>
          <p>• Always log out on shared or public computers</p>
        </CardContent>
      </Card>
    </div>
  );
}
