import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import type { MonitoredEmail } from "@/lib/types";

const DISMISS_KEY = "subsbuzz.categorizationBannerDismissed";

export function CategorizationBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  const { data: senders = [] } = useQuery<MonitoredEmail[]>({
    queryKey: ["/api/monitored-emails"],
    queryFn: () => api.get<MonitoredEmail[]>("/api/monitored-emails"),
    staleTime: 60_000,
  });

  const uncategorized = senders.filter((s) => s.categoryId == null).length;

  useEffect(() => {
    if (uncategorized === 0 && !dismissed) {
      // Auto-hide when the user finishes categorizing everyone.
      setDismissed(true);
    }
  }, [uncategorized, dismissed]);

  if (dismissed || uncategorized === 0) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="border-b border-border bg-accent/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <p className="text-foreground">
          <span className="font-medium">{uncategorized}</span>{" "}
          {uncategorized === 1 ? "sender is" : "senders are"} missing a category.{" "}
          <Link
            href="/email-handling/senders"
            className="underline underline-offset-2 hover:text-accent"
          >
            Categorize them
          </Link>{" "}
          to group articles in your digest and Collections.
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="h-6 w-6"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
