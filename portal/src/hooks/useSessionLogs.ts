"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DashboardStats, RepoSummary } from "@/types/activity";

interface DashboardData {
  stats: DashboardStats;
  recentSessions: SessionRow[];
}

interface SessionRow {
  id: string;
  sessionId: string;
  repoOwner: string;
  repoName: string;
  branch: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  summary: string | null;
  filesChanged: string[];
  commits: { sha: string | null; message: string }[];
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
  entrypoint: string | null;
  toolsUsed: string[];
}

interface ActivityData {
  sessions: SessionRow[];
  total: number;
  limit: number;
  offset: number;
}

interface RepoLogsData {
  owner: string;
  repo: string;
  stats: {
    totalSessions: number;
    totalCommits: number;
    totalFilesChanged: number;
    totalTokens: number;
  };
  sessions: SessionRow[];
}

export function useDashboard(range?: string) {
  const params = range ? `?range=${range}` : "";
  return useQuery<DashboardData>({
    queryKey: ["dashboard", range],
    queryFn: () => fetch(`/api/sessions${params}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });
}

export function useActivity(params?: {
  repo?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}) {
  const searchParams = new URLSearchParams();
  if (params?.repo) searchParams.set("repo", params.repo);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));
  if (params?.order) searchParams.set("order", params.order);

  return useQuery<ActivityData>({
    queryKey: ["activity", params],
    queryFn: () =>
      fetch(`/api/activity?${searchParams}`).then((r) => r.json()),
    refetchInterval: 30_000,
  });
}

export function useRepos() {
  return useQuery<{ repos: RepoSummary[] }>({
    queryKey: ["repos"],
    queryFn: () => fetch("/api/repos").then((r) => r.json()),
    refetchInterval: 60_000,
  });
}

export function useRepoLogs(owner: string, repo: string) {
  return useQuery<RepoLogsData>({
    queryKey: ["repoLogs", owner, repo],
    queryFn: () =>
      fetch(`/api/repos/${owner}/${repo}/logs`).then((r) => r.json()),
    refetchInterval: 30_000,
  });
}

export function useSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetch("/api/sync", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    },
  });
}

export type { SessionRow, DashboardData, ActivityData, RepoLogsData };
