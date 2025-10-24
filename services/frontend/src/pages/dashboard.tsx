import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Hash, CalendarDays, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { EmailDigest, DigestKanbanColumn, ChartDataPoint } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout";
import { StatsCard, KanbanBoard, BarChart, GaugeChart } from "@/components/dashboard";

function categorizeDigests(digests: EmailDigest[]): DigestKanbanColumn[] {
  const today = new Date();
  const startOfWeek = new Date();
  startOfWeek.setDate(today.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const columns: Record<string, EmailDigest[]> = {
    today: [],
    week: [],
    archive: [],
  };

  digests.forEach((digest) => {
    const digestDate = new Date(digest.date);
    digestDate.setHours(0, 0, 0, 0);

    if (digestDate.toDateString() === today.toDateString()) {
      columns.today.push(digest);
    } else if (digestDate >= startOfWeek) {
      columns.week.push(digest);
    } else {
      columns.archive.push(digest);
    }
  });

  const buildColumn = (key: keyof typeof columns, title: string): DigestKanbanColumn => ({
    id: key,
    title,
    count: columns[key].length,
      cards: columns[key].map((digest, index) => ({
        id: digest.id,
        title: formatDate(new Date(digest.date)),
        description: `${digest.emailsProcessed} emails summarised with ${digest.topicsIdentified} topics`,
        dateLabel: new Date(digest.date).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        dateISO: new Date(digest.date).toISOString().split("T")[0],
        emailsProcessed: digest.emailsProcessed,
        topicsIdentified: digest.topicsIdentified,
        type: "regular",
        isHighlighted: key === "today" && index === 0,
      })),
  });

  return [
    buildColumn("today", "Today"),
    buildColumn("week", "This week"),
    buildColumn("archive", "Archive"),
  ];
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: digestHistoryResponse, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["/api/digest/history"],
    refetchOnWindowFocus: false,
  });

  const digestHistory: EmailDigest[] = Array.isArray(digestHistoryResponse)
    ? digestHistoryResponse
    : digestHistoryResponse?.digests ?? digestHistoryResponse?.data ?? [];

  const generateDigestMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/api/digest/generate", {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Digest generation started",
        description: "We will notify you once processing completes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/digest/history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Digest generation failed",
        description: error.message ?? "Failed to generate digest. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredDigests = useMemo(() => {
    if (!searchQuery) return digestHistory;
    const lower = searchQuery.toLowerCase();
    return digestHistory.filter((digest) => {
      const formattedDate = formatDate(new Date(digest.date)).toLowerCase();
      return (
        formattedDate.includes(lower) ||
        digest.emailsProcessed.toString().includes(lower) ||
        digest.topicsIdentified.toString().includes(lower)
      );
    });
  }, [digestHistory, searchQuery]);

  const kanbanColumns = useMemo(() => categorizeDigests(filteredDigests), [filteredDigests]);

  const stats = useMemo(() => {
    const totalDigests = digestHistory.length;
    const totalEmails = digestHistory.reduce((sum, digest) => sum + digest.emailsProcessed, 0);
    const totalTopics = digestHistory.reduce((sum, digest) => sum + digest.topicsIdentified, 0);

    const today = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(today.getDate() - 6);

    const thisWeekDigests = digestHistory.filter((digest) => new Date(digest.date) >= startOfWeek);
    const previousWeekDigests = digestHistory.filter((digest) => {
      const date = new Date(digest.date);
      return date < startOfWeek && date >= new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    });

    const digestDelta = thisWeekDigests.length - previousWeekDigests.length;
    const emailsDelta =
      thisWeekDigests.reduce((sum, digest) => sum + digest.emailsProcessed, 0) -
      previousWeekDigests.reduce((sum, digest) => sum + digest.emailsProcessed, 0);

    const digestTrend = digestDelta === 0 ? "neutral" : digestDelta > 0 ? "up" : "down";
    const emailsTrend = emailsDelta === 0 ? "neutral" : emailsDelta > 0 ? "up" : "down";

    const successRate = totalDigests
      ? (digestHistory.filter((digest) => digest.topicsIdentified > 0).length / totalDigests) * 100
      : 0;

    return {
      totalDigests,
      totalEmails,
      totalTopics,
      digestDelta,
      emailsDelta,
      digestTrend,
      emailsTrend,
      successRate,
    } as const;
  }, [digestHistory]);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return digestHistory
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-6)
      .map((digest) => ({
        name: new Date(digest.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: digest.emailsProcessed,
      }));
  }, [digestHistory]);

  const handleViewDigest = (dateISO: string) => {
    setLocation(`/digest/${dateISO}`);
  };

  if (authLoading || isHistoryLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading your digests...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      headerProps={{
        onSearch: setSearchQuery,
        onAddClick: () => setLocation("/settings"),
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Your Digest Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Track digest performance, recent activity, and upcoming summaries.
            </p>
          </div>
          <Button
            onClick={() => generateDigestMutation.mutate()}
            disabled={generateDigestMutation.isPending}
            className="flex items-center gap-2"
          >
            {generateDigestMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Generate digest
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Total digests"
            value={stats.totalDigests}
            subtitle="Published in your workspace"
            trend={stats.digestTrend}
            trendValue={
              stats.digestTrend !== "neutral"
                ? `${stats.digestDelta > 0 ? "+" : ""}${stats.digestDelta}`
                : undefined
            }
            icon={
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-secondary">
                <Mail className="h-3.5 w-3.5" />
              </span>
            }
            actionLabel="View history"
            onActionClick={() => setLocation("/history")}
          />
          <StatsCard
            title="Emails processed"
            value={stats.totalEmails}
            subtitle="All time"
            trend={stats.emailsTrend}
            trendValue={
              stats.emailsTrend !== "neutral"
                ? `${stats.emailsDelta > 0 ? "+" : ""}${stats.emailsDelta}`
                : undefined
            }
            icon={
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-secondary">
                <Hash className="h-3.5 w-3.5" />
              </span>
            }
          />
          <StatsCard
            title="Topics identified"
            value={stats.totalTopics}
            subtitle="Across every digest"
            icon={
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-secondary">
                <CalendarDays className="h-3.5 w-3.5" />
              </span>
            }
          />
        </div>

        {chartData.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            <BarChart
              data={chartData}
              title="Emails processed"
              description="Last six digests"
            />
            <GaugeChart value={stats.successRate} title="Topic coverage" label="Digests with insights" />
          </div>
        ) : null}

        {filteredDigests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-semibold text-foreground">No digests yet</p>
              <p className="mt-2 text-muted-foreground">
                Once your first digest finishes processing it will appear here.
              </p>
              <Button className="mt-6" onClick={() => setLocation("/settings")} variant="outline">
                Configure email sources
              </Button>
            </CardContent>
          </Card>
        ) : (
          <KanbanBoard columns={kanbanColumns} onCardClick={handleViewDigest} />
        )}
      </div>
    </DashboardLayout>
  );
}
