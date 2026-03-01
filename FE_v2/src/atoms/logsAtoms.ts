import { atom } from "jotai";
import { JsonValue } from "@/api/logsApi";

export interface Log {
  id: string;
  level: string;
  message: string;
  metadata?: Record<string, JsonValue>;
  timestamp: string;
}

export interface LogsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const logsAtom = atom<Log[]>([]);
export const logsPaginationAtom = atom<LogsPagination>({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
});
export const logsLoadingAtom = atom<boolean>(false);

