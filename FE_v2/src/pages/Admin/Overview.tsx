import { useEffect, useCallback } from "react";
import { useMetrics } from "@/hooks/useMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Activity, Users, Globe, TrendingUp } from "lucide-react";

export function AdminOverview() {
  const { summary, topEndpoints, metrics, isLoading, fetchSummary } = useMetrics();

  const loadSummary = useCallback(() => {
    fetchSummary().catch(console.error);
  }, [fetchSummary]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">System metrics and activity overview</p>
      </div>

      {isLoading && !summary && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <LoadingSpinner />
            </div>
          </CardContent>
        </Card>
      )}

      {summary ? (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Total Requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Authenticated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.authenticatedRequests.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Anonymous
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.anonymousRequests.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Unique Paths
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.uniquePaths}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints</CardTitle>
              <CardDescription>Most frequently accessed API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{endpoint.path}</div>
                    </div>
                    <div className="flex gap-6 items-center">
                      <div className="text-sm text-muted-foreground">
                        {endpoint.count} requests
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {endpoint.avgResponseTime}ms avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest API requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.slice(0, 10).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{metric.path}</div>
                      <div className="text-xs text-muted-foreground">
                        {metric.username || "Anonymous"} • {new Date(metric.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {metric.responseTime}ms
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        !isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Metrics are not available yet.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

