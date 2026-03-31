"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsData, TimeRange } from "@/types/analytics";

export function useAnalytics(range: TimeRange) {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics", range],
    queryFn: () =>
      fetch(`/api/analytics?range=${range}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });
}
