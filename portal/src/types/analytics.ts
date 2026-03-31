export type TimeRange = "today" | "7d" | "30d" | "90d" | "all";

export interface TokenTrendPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
}

export interface SessionTrendPoint {
  date: string;
  count: number;
  repos: Record<string, number>;
}

export interface ModelBreakdownEntry {
  model: string;
  tokens: number;
  sessions: number;
}

export interface RepoBreakdownEntry {
  repo: string;
  tokens: number;
  sessions: number;
}

export interface AnalyticsInsights {
  avgDuration: number;
  avgTokensPerSession: number;
  peakHour: number;
  cacheHitRate: number;
}

export interface AnalyticsData {
  tokenTrend: TokenTrendPoint[];
  sessionTrend: SessionTrendPoint[];
  modelBreakdown: ModelBreakdownEntry[];
  repoBreakdown: RepoBreakdownEntry[];
  insights: AnalyticsInsights;
}
