import { useAtom } from "jotai";
import {
  metricsAtom,
  metricsLoadingAtom,
  metricsSummaryAtom,
  topEndpointsAtom,
} from "@/atoms/metricsAtoms";
import { metricsApi } from "@/api/metricsApi";

export function useMetrics() {
  const [metrics, setMetrics] = useAtom(metricsAtom);
  const [summary, setSummary] = useAtom(metricsSummaryAtom);
  const [topEndpoints, setTopEndpoints] = useAtom(topEndpointsAtom);
  const [isLoading, setIsLoading] = useAtom(metricsLoadingAtom);

  const fetchMetrics = async (page = 1, limit = 50, path?: string) => {
    try {
      setIsLoading(true);
      const response = await metricsApi.getMetrics(page, limit, path);
      setMetrics(response.metrics);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      const response = await metricsApi.getMetricsSummary();
      setSummary(response.summary);
      setTopEndpoints(response.topEndpoints || []);
      setMetrics(response.recentActivity || []);
    } catch (error) {
      console.error("Failed to fetch metrics summary:", error);
      if (window.toast) {
        window.toast({
          title: "Error",
          description: "Failed to refresh metrics. Showing last known data.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearMetrics = async () => {
    try {
      await metricsApi.clearMetrics();
      setMetrics([]);
      setSummary(null);
      setTopEndpoints([]);

      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Metrics cleared successfully",
        });
      }
    } catch (error) {
      console.error("Failed to clear metrics:", error);
      throw error;
    }
  };

  return {
    metrics,
    summary,
    topEndpoints,
    isLoading,
    fetchMetrics,
    fetchSummary,
    clearMetrics,
  };
}

