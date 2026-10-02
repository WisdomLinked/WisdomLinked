import React, { createContext, useContext, useMemo } from 'react';

export type PendingContactRequestsCountApi = {
  count: number;
  refresh: () => Promise<void>;
  decrement: () => void;
};

const PendingContactRequestsCountContext =
  createContext<PendingContactRequestsCountApi | null>(null);

const noopRefresh = async () => {};
const noopDecrement = () => {};

export function PendingContactRequestsProvider({
  children,
  count,
  refresh,
  decrement,
}: {
  children: React.ReactNode;
  count: number;
  refresh: () => Promise<void>;
  decrement: () => void;
}) {
  const value = useMemo<PendingContactRequestsCountApi>(
    () => ({
      count: Math.max(0, Math.floor(Number(count) || 0)),
      refresh,
      decrement,
    }),
    [count, refresh, decrement],
  );

  return (
    <PendingContactRequestsCountContext.Provider value={value}>
      {children}
    </PendingContactRequestsCountContext.Provider>
  );
}

/** Shared Needs Response count (`actioned !== "Yes"` / `actioned: "No"`). */
export function usePendingContactRequestsCount(): PendingContactRequestsCountApi {
  return (
    useContext(PendingContactRequestsCountContext) ?? {
      count: 0,
      refresh: noopRefresh,
      decrement: noopDecrement,
    }
  );
}
