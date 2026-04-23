import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { EmailDigest, ChartDataPoint } from "@/lib/types";
import { DashboardLayout } from "@/components/layout";
import { AddSenderModal } from "@/components/settings/add-sender-modal";
import { StatsCard, BarChart } from "@/components/dashboard";
import { Loader2, Mail, Hash, CalendarDays, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function History() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddSenderOpen, setIsAddSenderOpen] = useState(false);
  const [isRerunConfirmOpen, setIsRerunConfirmOpen] = useState(false);
  const [isNoSendersOpen, setIsNoSendersOpen] = useState(false);
  const [pendingDigestId, setPendingDigestId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: monitoredEmails = [] } = useQuery<unknown[]>({
    queryKey: ["/api/monitored-emails"],
    refetchOnWindowFocus: false,
  });

  const { data: digestHistoryRaw = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["/api/digest/history"],
    refetchOnWindowFocus: false,
    refetchInterval: pendingDigestId !== null ? 3000 : false,
  });

  const digestHistory: EmailDigest[] = Array.isArray(digestHistoryRaw)
    ? digestHistoryRaw
    : (digestHistoryRaw as any)?.digests ?? (digestHistoryRaw as any)?.data ?? [];

  const { data: availableDatesResponse } = useQuery({
    queryKey: ["/api/digest/available-dates"],
    refetchOnWindowFocus: false,
  });

  const availableDates: string[] = useMemo(() => {
    if (Array.isArray(availableDatesResponse)) return availableDatesResponse;
    return (availableDatesResponse as any)?.dates ?? [];
  }, [availableDatesResponse]);

  const generateDigestMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      return await api.post("/api/digest/generate", { force });
    },
    onSuccess: () => {
      toast({
        title: "Digest generation started",
        description: "We will notify you once processing completes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/digest/history"] });
    },
    onError: (error: any) => {
      setPendingDigestId(null);
      toast({
        title: "Digest generation failed",
        description: error.message ?? "Failed to generate digest. Please try again.",
        variant: "destructive",
      });
    },
  });

  const todaysDigest = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return digestHistory.find((digest) => {
      const d = new Date(digest.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
  }, [digestHistory]);

  // Clear pending state once the row has been replaced (id changes) or removed.
  useEffect(() => {
    if (pendingDigestId === null) return;
    if (!todaysDigest || todaysDigest.id !== pendingDigestId) {
      setPendingDigestId(null);
      toast({ title: "Digest regenerated", description: "Today's digest has been refreshed." });
    }
  }, [pendingDigestId, todaysDigest, toast]);

  // Safety timeout: never leave the card spinning past 5 min.
  useEffect(() => {
    if (pendingDigestId === null) return;
    const timeout = setTimeout(() => {
      setPendingDigestId(null);
      toast({
        title: "Regeneration timed out",
        description: "The digest didn't update within 5 minutes. Check the worker logs or try again.",
        variant: "destructive",
      });
    }, 5 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [pendingDigestId, toast]);

  const handleGenerateDigestClick = () => {
    if (!Array.isArray(monitoredEmails) || monitoredEmails.length === 0) {
      setIsNoSendersOpen(true);
      return;
    }
    if (todaysDigest) {
      setIsRerunConfirmOpen(true);
    } else {
      generateDigestMutation.mutate(false);
    }
  };

  const handleConfirmRerun = () => {
    setIsRerunConfirmOpen(false);
    if (todaysDigest) setPendingDigestId(todaysDigest.id);
    generateDigestMutation.mutate(true);
  };

  const stats = useMemo(() => {
    const totalDigests = digestHistory.length;
    const totalEmails = digestHistory.reduce((sum, d) => sum + d.emailsProcessed, 0);
    const totalTopics = digestHistory.reduce((sum, d) => sum + d.topicsIdentified, 0);

    const today = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(today.getDate() - 6);

    const thisWeek = digestHistory.filter((d) => new Date(d.date) >= startOfWeek);
    const prevWeek = digestHistory.filter((d) => {
      const date = new Date(d.date);
      return date < startOfWeek && date >= new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    });

    const digestDelta = thisWeek.length - prevWeek.length;
    const emailsDelta =
      thisWeek.reduce((sum, d) => sum + d.emailsProcessed, 0) -
      prevWeek.reduce((sum, d) => sum + d.emailsProcessed, 0);

    return {
      totalDigests,
      totalEmails,
      totalTopics,
      digestDelta,
      emailsDelta,
      digestTrend: (digestDelta === 0 ? "neutral" : digestDelta > 0 ? "up" : "down") as "neutral" | "up" | "down",
      emailsTrend: (emailsDelta === 0 ? "neutral" : emailsDelta > 0 ? "up" : "down") as "neutral" | "up" | "down",
    };
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

  if (authLoading || isHistoryLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading your digests…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout headerProps={{ onAddClick: () => setIsAddSenderOpen(true) }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Digest history</h1>
            <p className="text-sm text-muted-foreground">
              Track activity and browse every past digest.
            </p>
          </div>
          <Button
            onClick={handleGenerateDigestClick}
            disabled={generateDigestMutation.isPending}
            className="flex items-center gap-2"
          >
            {generateDigestMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
            ) : (
              <><RefreshCw className="h-4 w-4" />Generate digest</>
            )}
          </Button>
        </div>

        {/* Stats */}
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

        {/* Bar chart */}
        {chartData.length > 0 && (
          <BarChart data={chartData} title="Emails processed" description="Last six digests" />
        )}

        {/* Calendar + recent digests */}
        {digestHistory.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-semibold text-foreground">No digests yet</p>
              <p className="mt-2 text-muted-foreground">
                Once your first digest finishes processing it will appear here.
              </p>
              <Button className="mt-6" onClick={() => setLocation("/email-handling/senders")} variant="outline">
                Configure email sources
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid gap-6 p-6 md:grid-cols-[300px_1fr]">
              <div className="mx-auto md:mx-0">
                <Calendar
                  mode="single"
                  onSelect={(selectedDate) => {
                    if (selectedDate) {
                      const dateStr = selectedDate.toISOString().split("T")[0];
                      setLocation(`/digest/${dateStr}`);
                    }
                  }}
                  className="rounded-xl border"
                  disabled={(candidate) => {
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    if (candidate > today) return true;
                    const dateStr = candidate.toISOString().split("T")[0];
                    return !availableDates.includes(dateStr);
                  }}
                />
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent digests</h4>
                  <div className="grid gap-2 md:grid-cols-2">
                    {digestHistory.slice(0, 6).map((digest: EmailDigest) => (
                      <button
                        key={digest.id}
                        onClick={() => {
                          const dateStr = new Date(digest.date).toISOString().split("T")[0];
                          setLocation(`/digest/${dateStr}`);
                        }}
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition hover:border-muted hover:bg-muted/60"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {formatDate(new Date(digest.date))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {digest.emailsProcessed} emails · {digest.topicsIdentified} topics
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AddSenderModal open={isAddSenderOpen} onOpenChange={setIsAddSenderOpen} />

      <AlertDialog open={isRerunConfirmOpen} onOpenChange={setIsRerunConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run today's digest?</AlertDialogTitle>
            <AlertDialogDescription>
              A digest already exists for today. Re-running will replace it with a freshly generated version.
              <br /><br />
              <strong>Note:</strong> This will incur additional OpenAI token usage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRerun}>Yes, re-run</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isNoSendersOpen} onOpenChange={setIsNoSendersOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No email sources configured</AlertDialogTitle>
            <AlertDialogDescription>
              You need to add at least one newsletter or sender to monitor before generating a digest. Head to Email Handling to add your first source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIsNoSendersOpen(false); setLocation("/email-handling"); }}>
              Go to Email Handling
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
