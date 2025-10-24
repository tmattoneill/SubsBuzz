import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThematicDigest } from "@/components/ui/thematic-digest";
import { DigestCard } from "@/components/ui/digest-card";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/utils";
import { FullThematicDigest } from "@/lib/types";
import { DashboardLayout } from "@/components/layout";
import { Loader2 } from "lucide-react";

export default function DigestView() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/digest/:date");

  const dateParam = params?.date;

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!match || !dateParam) {
      setLocation("/dashboard");
    }
  }, [match, dateParam, setLocation]);

  const {
    data: digestData,
    isLoading: isDigestLoading,
    isError: isDigestError,
  } = useQuery({
    queryKey: ["/api/digest/date", dateParam],
    enabled: !!dateParam,
    refetchOnWindowFocus: false,
  });

  const renderActions = () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
      <Button variant="outline" onClick={() => setLocation("/history")}>History</Button>
    </div>
  );

  if (authLoading || isDigestLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading digest…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isDigestError || !digestData) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 p-6 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            No digest found for {dateParam}
          </h2>
          <p className="text-sm text-muted-foreground">
            There isn&apos;t a digest available for this date yet. Try another day from your history.
          </p>
          {renderActions()}
        </div>
      </DashboardLayout>
    );
  }

  const digest = digestData;
  const digestDate = new Date(digest.date);
  const isThematicDigest = digest.type === "thematic";

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Digest for</p>
            <h1 className="text-2xl font-semibold text-foreground">{formatDate(digestDate)}</h1>
          </div>
          {renderActions()}
        </div>

        <div className="space-y-6">
          {isThematicDigest ? (
            <ThematicDigest digest={digest as FullThematicDigest} />
          ) : digest.emails && digest.emails.length > 0 ? (
            digest.emails.map((email: any) => <DigestCard key={email.id} email={email} />)
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No emails found in this digest.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
