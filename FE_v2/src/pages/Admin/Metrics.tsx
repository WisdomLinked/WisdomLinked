import { useEffect, useState, useCallback } from "react";
import { useMetrics } from "@/hooks/useMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Trash2 } from "lucide-react";

export function MetricsPage() {
  const { metrics, summary, topEndpoints, isLoading, fetchSummary, clearMetrics } = useMetrics();
  const [page, _setPage] = useState(1);

  const loadSummary = useCallback(() => {
    fetchSummary().catch(console.error);
  }, [fetchSummary]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, page]);

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear all metrics? This action cannot be undone.")) {
      await clearMetrics();
      fetchSummary();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metrics</h1>
          <p className="text-muted-foreground mt-1">API endpoint metrics and analytics</p>
        </div>
        <Button variant="destructive" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Metrics
        </Button>
      </div>

      {isLoading && !summary ? (
        <LoadingSpinner />
      ) : (
        <>
          {summary && (
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Authenticated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.authenticatedRequests.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((summary.authenticatedRequests / summary.totalRequests) * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Anonymous</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.anonymousRequests.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {((summary.anonymousRequests / summary.totalRequests) * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Unique Endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.uniquePaths}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints</CardTitle>
              <CardDescription>Most frequently accessed API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topEndpoints.map((endpoint, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm font-medium">{endpoint.path}</div>
                    </div>
                    <div className="flex gap-6 items-center text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">{endpoint.count}</span> requests
                      </div>
                      <div>
                        <span className="font-medium">{endpoint.avgResponseTime}ms</span> avg
                      </div>
                    </div>
                  </div>
                ))}
                {topEndpoints.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No metrics data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Latest API activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="flex items-center justify-between p-2 hover:bg-accent rounded"
                  >
                    <div className="flex-1">
                      <div className="font-mono text-sm">{metric.path}</div>
                      <div className="text-xs text-muted-foreground">
                        {metric.username || "Anonymous"} • {metric.ip} •{" "}
                        {new Date(metric.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div>{metric.method}</div>
                      <div>{metric.responseTime}ms</div>
                      <div
                        className={
                          metric.statusCode && metric.statusCode >= 400
                            ? "text-destructive"
                            : ""
                        }
                      >
                        {metric.statusCode}
                      </div>
                    </div>
                  </div>
                ))}
                {metrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

