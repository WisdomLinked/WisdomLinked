import { useAtom } from "jotai";
import { logsAtom, logsLoadingAtom, logsPaginationAtom } from "@/atoms/logsAtoms";
import { logsApi } from "@/api/logsApi";

export function useLogs() {
  const [logs, setLogs] = useAtom(logsAtom);
  const [pagination, setPagination] = useAtom(logsPaginationAtom);
  const [isLoading, setIsLoading] = useAtom(logsLoadingAtom);

  const fetchLogs = async (page = 1, limit = 50, level?: string) => {
    try {
      setIsLoading(true);
      const response = await logsApi.getLogs(page, limit, level);
      setLogs(response.logs);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await logsApi.clearLogs();
      setLogs([]);
      setPagination({ page: 1, limit: 50, total: 0, totalPages: 0 });

      if (window.toast) {
        window.toast({
          title: "Success",
          description: "Logs cleared successfully",
        });
      }
    } catch (error) {
      console.error("Failed to clear logs:", error);
      throw error;
    }
  };

  return {
    logs,
    pagination,
    isLoading,
    fetchLogs,
    clearLogs,
  };
}

