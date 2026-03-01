import { useEffect, useState, useCallback } from "react";
import { useLogs } from "@/hooks/useLogs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Trash2, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";

export function LogsPage() {
  const { logs, pagination, isLoading, fetchLogs, clearLogs } = useLogs();
  const [levelFilter, setLevelFilter] = useState<string | undefined>();

  const loadLogs = useCallback(() => {
    fetchLogs(1, 50, levelFilter).catch(console.error);
  }, [fetchLogs, levelFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all logs? This action cannot be undone.")) {
      await clearLogs();
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "debug":
        return <Bug className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "text-destructive";
      case "warn":
        return "text-yellow-500";
      case "debug":
        return "text-blue-500";
      default:
        return "text-blue-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs</h1>
          <p className="text-muted-foreground mt-1">System logs and error tracking</p>
        </div>
        <Button variant="destructive" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Logs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter by Level</CardTitle>
              <CardDescription>View logs by severity level</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              Total: {pagination.total} logs
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={!levelFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter(undefined)}
            >
              All
            </Button>
            <Button
              variant={levelFilter === "info" ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter("info")}
            >
              Info
            </Button>
            <Button
              variant={levelFilter === "warn" ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter("warn")}
            >
              Warning
            </Button>
            <Button
              variant={levelFilter === "error" ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter("error")}
            >
              Error
            </Button>
            <Button
              variant={levelFilter === "debug" ? "default" : "outline"}
              size="sm"
              onClick={() => setLevelFilter("debug")}
            >
              Debug
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && logs.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Log Entries</CardTitle>
            <CardDescription>
              Showing {logs.length} of {pagination.total} logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium uppercase ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm font-medium">{log.message}</div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View metadata
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-words">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No logs found
                  {levelFilter && ` for level: ${levelFilter}`}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

