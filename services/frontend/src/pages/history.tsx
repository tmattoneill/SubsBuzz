import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { ThematicDigest } from "@/components/ui/thematic-digest";
import { DigestCard } from "@/components/ui/digest-card";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/utils";
import { EmailDigest, FullThematicDigest } from "@/lib/types";
import { DashboardLayout } from "@/components/layout";

export default function History() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [date, setDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const { data: digestHistory = [] } = useQuery({
    queryKey: ["/api/digest/history"],
    refetchOnWindowFocus: false,
  });

  const { data: availableDatesResponse } = useQuery({
    queryKey: ["/api/digest/available-dates"],
    refetchOnWindowFocus: false,
  });

  const availableDates: string[] = useMemo(() => {
    if (Array.isArray(availableDatesResponse)) return availableDatesResponse;
    return availableDatesResponse?.dates ?? [];
  }, [availableDatesResponse]);

  const { data: selectedDateDigest, isLoading: isLoadingDateDigest } = useQuery({
    queryKey: ["/api/digest/date", date?.toISOString().split("T")[0]],
    enabled: !!date,
    refetchOnWindowFocus: false,
  });

  return (
    <DashboardLayout
      headerProps={{
        onAddClick: () => setLocation("/settings"),
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Digest history</h1>
          <p className="text-sm text-muted-foreground">
            Browse every generated digest and jump into past summaries.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-6 p-6 md:grid-cols-[300px_1fr]">
            <div className="mx-auto md:mx-0">
              <Calendar
                mode="single"
                selected={date}
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

            <div className="flex flex-col justify-center gap-4 text-center md:text-left">
              <div>
                <p className="text-sm text-muted-foreground">Selected date</p>
                <p className="text-lg font-semibold text-foreground">
                  {date ? formatDate(date) : "Select a date"}
                </p>
              </div>

              {isLoadingDateDigest ? (
                <p className="text-muted-foreground">Loading digest…</p>
              ) : selectedDateDigest ? (
                <p className="text-green-600 dark:text-green-400">Digest available for this date.</p>
              ) : (
                <p className="text-muted-foreground">No digest found for this date.</p>
              )}

              <Button
                variant="outline"
                className="self-start"
                onClick={() => setLocation("/dashboard")}
              >
                Back to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedDateDigest ? (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-foreground">
              Digest for {date ? formatDate(date) : "selected date"}
            </h2>
            {selectedDateDigest.type === "thematic" ? (
              <ThematicDigest digest={selectedDateDigest as FullThematicDigest} />
            ) : (
              <DigestCard digest={selectedDateDigest} />
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2 text-center">
                <h3 className="text-lg font-semibold text-foreground">Your digest archive</h3>
                <p className="text-sm text-muted-foreground">
                  You have {digestHistory.length} digest{digestHistory.length === 1 ? "" : "s"} ready to review.
                  Choose a date above or pick from recent activity below.
                </p>
              </div>

              {digestHistory.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent digests</h4>
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
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
