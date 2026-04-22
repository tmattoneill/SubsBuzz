import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { Subscription, EmailCategory } from "@/lib/types";

interface SplitDetectionBannerProps {
  senderEmail: string;
  senderId: number;
  subscriptions: Subscription[];
  categoryMap: Map<number, EmailCategory>;
  onAdjust: () => void;
}

/**
 * Shown the first time a sender produces 2+ subscriptions. Lists the
 * auto-assigned categories and lets the user confirm ("Looks good"), jump
 * into the inline adjust flow, or dismiss silently (X). Any of those three
 * paths POSTs /api/subscriptions/sender/:senderId/dismiss-banner which also
 * marks every child subscription user_confirmed.
 */
export function SplitDetectionBanner({
  senderEmail,
  senderId,
  subscriptions,
  categoryMap,
  onAdjust,
}: SplitDetectionBannerProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const dismiss = useMutation({
    mutationFn: () => api.post(`/api/subscriptions/sender/${senderId}/dismiss-banner`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
    },
    onError: (err: any) =>
      toast({
        title: "Could not dismiss banner",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <Sparkles className="h-4 w-4" />
      <AlertTitle className="pr-8">
        We noticed <span className="font-mono">{senderEmail}</span> sends multiple newsletters.
      </AlertTitle>
      <AlertDescription className="space-y-2 pt-1">
        <p className="text-sm text-muted-foreground">
          We've split them automatically and suggested categories based on content:
        </p>
        <ul className="space-y-1 text-sm">
          {subscriptions.map((s) => {
            const cat = s.categoryId ? categoryMap.get(s.categoryId) : null;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span className="font-medium">{s.displayName}</span>
                <span className="text-muted-foreground">→</span>
                <span>{cat?.name ?? "Uncategorised"}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
            Looks good
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onAdjust();
              dismiss.mutate();
            }}
          >
            Adjust
          </Button>
        </div>
      </AlertDescription>
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        onClick={() => dismiss.mutate()}
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}

/**
 * Decide whether a sender's group of subscriptions should show the split
 * banner. Rules:
 *   - ≥2 subscriptions under this sender
 *   - at least one not yet user_confirmed
 *   - banner not previously dismissed
 *   - the most recent subscription was first seen within 48h (auto-dismiss)
 */
export function shouldShowSplitBanner(subscriptions: Subscription[]): boolean {
  if (subscriptions.length < 2) return false;
  const first = subscriptions[0];
  if (first.senderSplitBannerDismissedAt) return false;
  const anyUnconfirmed = subscriptions.some((s) => !s.userConfirmed);
  if (!anyUnconfirmed) return false;
  const newest = subscriptions.reduce<string>((acc, s) => (s.firstSeenAt > acc ? s.firstSeenAt : acc), subscriptions[0].firstSeenAt);
  const newestDate = new Date(newest);
  const ageMs = Date.now() - newestDate.getTime();
  return ageMs < 48 * 60 * 60 * 1000;
}
