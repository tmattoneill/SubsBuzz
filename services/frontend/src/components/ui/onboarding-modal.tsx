import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { useCategories } from "@/hooks/useCategories";
import type { NewsletterSender, InboxCleanupAction, EmailCategory } from "@/lib/types";
import { CheckCircle, Loader2, Search, Sparkles, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

/**
 * Onboarding wizard for new SubsBuzz users (TEEPER-208).
 *
 *   1. SCANNING       — POST /api/onboarding/scan, poll /scan/:taskId
 *   2. SUGGESTIONS    — list of detected newsletters with category dropdowns
 *   3. CLEANUP        — what to do with new mail from selected senders
 *   4. CONFIRMATION   — bulk-add senders, persist settings, mark complete
 *
 * "Skip for now" on every step writes user_settings.onboarding_dismissed_at
 * so the modal stays away on subsequent logins.
 */

type OnboardingStep =
  | "scanning"
  | "suggestions"
  | "cleanup"
  | "confirming"
  | "first_digest" // NEW — offers an immediate digest run; user can accept or skip
  | "done";

interface ScanResult {
  scanned_at: string;
  count: number;
  newsletters: NewsletterSender[];
}

interface ScanPollResponse {
  status: "pending" | "done" | "failed";
  task_id: string;
  result?: ScanResult;
  error?: string;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLEANUP_LABELS: Record<InboxCleanupAction, { title: string; subtitle: string }> = {
  none: { title: "Do nothing", subtitle: "Leave the original message in your inbox, untouched." },
  mark_read: { title: "Mark as read", subtitle: "Mark the source message read; keep it in your inbox." },
  mark_read_archive: { title: "Mark as read + archive", subtitle: "Read + remove from inbox (still searchable in All Mail)." },
  mark_read_label_archive: { title: "Mark as read + label SubsBuzz + archive", subtitle: "Read, label “SubsBuzz”, and archive. Recommended." },
  trash: { title: "Move to Trash", subtitle: "Send the source message to Trash." },
};

interface SelectionState {
  selected: boolean;
  categoryId: number | null;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [step, setStep] = useState<OnboardingStep>("scanning");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selections, setSelections] = useState<Record<string, SelectionState>>({});
  const [cleanupAction, setCleanupAction] = useState<InboxCleanupAction>("mark_read_label_archive");
  const [labelName, setLabelName] = useState("SubsBuzz");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  // True iff the user accepted the immediate-digest CTA on the first_digest
  // step. Drives the copy on the done step ("we're generating now" vs
  // "we'll send the first one at 03:00 UTC").
  const [digestRunImmediate, setDigestRunImmediate] = useState(false);

  // Map category slug → id, derived from the user's categories (lazy-seeded
  // by useCategories on first read). Lets us resolve the worker's
  // suggested_category_slug to a real categoryId for the picker.
  const slugToCategoryId = useMemo(() => {
    const m = new Map<string, number>();
    (categories as EmailCategory[]).forEach((c) => m.set(c.slug, c.id));
    return m;
  }, [categories]);

  // Kick off the scan exactly once when the modal opens.
  const kickedOff = useRef(false);
  useEffect(() => {
    if (!isOpen || kickedOff.current) return;
    kickedOff.current = true;
    setStep("scanning");
    setScanError(null);
    api
      .post<{ task_id: string }>("/api/onboarding/scan", {})
      .then((res) => setTaskId(res.task_id))
      .catch((err) => setScanError(err?.message ?? "Failed to start scan"));
  }, [isOpen]);

  // Poll the scan result every 2s while pending.
  useEffect(() => {
    if (!taskId || step !== "scanning") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.get<ScanPollResponse>(`/api/onboarding/scan/${taskId}`);
        if (cancelled) return;
        if (res.status === "pending") return;
        if (res.status === "failed") {
          setScanError(res.error ?? "Scan failed");
          return;
        }
        if (res.status === "done" && res.result) {
          setScanResult(res.result);
          // Default-checked: registry hits + anything with a List-Id (the
          // RFC-2919 strong signal). Senders with only List-Unsubscribe or a
          // body unsubscribe link land in the list but unchecked.
          const initial: Record<string, SelectionState> = {};
          for (const n of res.result.newsletters) {
            const defaultChecked = n.publication_match || !!n.list_id;
            initial[n.email] = {
              selected: defaultChecked,
              categoryId: n.suggested_category_slug
                ? slugToCategoryId.get(n.suggested_category_slug) ?? null
                : null,
            };
          }
          setSelections(initial);
          setStep("suggestions");
        }
      } catch (err: unknown) {
        if (!cancelled) setScanError((err as Error)?.message ?? "Polling error");
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [taskId, step, slugToCategoryId]);

  // Re-resolve suggested category ids once categories arrive (race: scan can
  // finish before useCategories has populated).
  useEffect(() => {
    if (!scanResult || slugToCategoryId.size === 0) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const n of scanResult.newsletters) {
        const slug = n.suggested_category_slug;
        if (!slug) continue;
        const cur = next[n.email];
        if (cur && cur.categoryId == null) {
          const id = slugToCategoryId.get(slug);
          if (id != null) next[n.email] = { ...cur, categoryId: id };
        }
      }
      return next;
    });
  }, [scanResult, slugToCategoryId]);

  const newsletters = scanResult?.newsletters ?? [];
  const selectedCount = Object.values(selections).filter((s) => s.selected).length;

  const toggleSelected = (email: string) => {
    setSelections((prev) => ({
      ...prev,
      [email]: { ...prev[email], selected: !prev[email]?.selected },
    }));
  };

  const setCategoryFor = (email: string, categoryId: number | null) => {
    setSelections((prev) => ({
      ...prev,
      [email]: { ...prev[email], categoryId },
    }));
  };

  const toggleExpand = (email: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      const items = newsletters
        .filter((n) => selections[n.email]?.selected)
        .map((n) => ({
          email: n.email,
          active: true,
          categoryId: selections[n.email]?.categoryId ?? null,
        }));

      if (items.length > 0) {
        await api.post("/api/monitored-emails/bulk", { items });
      }

      await api.patch("/api/settings", {
        inboxCleanupAction: cleanupAction,
        inboxCleanupLabelName: labelName,
        onboardingCompletedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      // Hand off to the first-digest CTA — gives the user the choice to run
      // a one-off digest now instead of waiting for the 03:00 UTC cron.
      setStep("first_digest");
    },
    onError: (err: unknown) => {
      toast({
        title: "Couldn't save your selections",
        description: (err as Error)?.message ?? "Try again",
        variant: "destructive",
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => api.patch("/api/settings", { onboardingDismissedAt: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      onClose();
    },
  });

  // First-digest CTA. Enqueues a one-off digest now so the user sees results
  // immediately instead of waiting for 03:00 UTC. The data-server's
  // POST /digest/generate path delegates to the email worker (process_user
  // _emails) — same code path the daily cron uses, just kicked off ad hoc.
  const runDigestMutation = useMutation({
    mutationFn: () => api.post("/api/digest/generate", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/digest"] });
      setDigestRunImmediate(true);
      setStep("done");
      toast({
        title: "Digest started",
        description: "Generating now — this usually takes a minute or two.",
      });
    },
    onError: (err: unknown) => {
      // Don't block the wizard on a transient broker hiccup — fall through to
      // done with the standard schedule copy. Toast surfaces the failure.
      setStep("done");
      toast({
        title: "Couldn't start digest now",
        description: (err as Error)?.message ?? "We'll send the first digest at 03:00 UTC instead.",
        variant: "destructive",
      });
    },
  });

  const stepIndex =
    step === "scanning"
      ? 1
      : step === "suggestions"
      ? 2
      : step === "cleanup"
      ? 3
      : step === "confirming"
      ? 4
      : 5; // first_digest + done both render at full progress
  const progress = (stepIndex / 5) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome to SubsBuzz
          </DialogTitle>
        </DialogHeader>

        <Progress value={progress} className="w-full" />

        <div className="min-h-[420px] py-4">
          {step === "scanning" && (
            <div className="flex flex-col items-center gap-6 py-10 text-center">
              {scanError ? (
                <>
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                  <div>
                    <h3 className="text-xl font-semibold">Scan failed</h3>
                    <p className="text-sm text-muted-foreground">{scanError}</p>
                  </div>
                  <Button onClick={() => skipMutation.mutate()}>Continue without scan</Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div>
                    <h3 className="text-xl font-semibold">Scanning your inbox</h3>
                    <p className="text-sm text-muted-foreground">
                      Looking through the last 3 days of mail for newsletters and subscriptions…
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "suggestions" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">We found {newsletters.length} newsletter{newsletters.length === 1 ? "" : "s"}</h3>
                <p className="text-sm text-muted-foreground">
                  Pick the ones you want SubsBuzz to track. Categories come from a 70-publisher registry where we
                  have a confident match; you can change any of them.
                </p>
              </div>

              {newsletters.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No newsletter-shaped mail in the last 72h. You can still add senders manually later.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{selectedCount} of {newsletters.length} selected</span>
                    <div className="space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelections((prev) =>
                            Object.fromEntries(
                              Object.entries(prev).map(([k, v]) => [k, { ...v, selected: false }]),
                            ),
                          )
                        }
                      >
                        Clear
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelections((prev) =>
                            Object.fromEntries(
                              Object.entries(prev).map(([k, v]) => [k, { ...v, selected: true }]),
                            ),
                          )
                        }
                      >
                        Select all
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {newsletters.map((n) => {
                      const sel = selections[n.email] ?? { selected: false, categoryId: null };
                      const isExpanded = expandedSubjects.has(n.email);
                      return (
                        <Card key={n.email}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={sel.selected}
                                onCheckedChange={() => toggleSelected(n.email)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {n.suggested_display_name || n.name || n.email}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">{n.email}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {n.publication_match && (
                                      <Badge variant="secondary" className="text-[10px]">registry</Badge>
                                    )}
                                    {n.list_id && (
                                      <Badge variant="outline" className="text-[10px]">List-Id</Badge>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">{n.count}×</Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <CategorySelect
                                    value={sel.categoryId}
                                    onChange={(id) => setCategoryFor(n.email, id)}
                                    allowUnset
                                    placeholder="Choose a category"
                                    className="h-8 text-xs"
                                  />
                                </div>

                                {n.sample_subjects.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(n.email)}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )}
                                    {isExpanded ? "Hide" : "Show"} {n.sample_subjects.length} recent subject
                                    {n.sample_subjects.length === 1 ? "" : "s"}
                                  </button>
                                )}
                                {isExpanded && (
                                  <ul className="mt-1 space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                                    {n.sample_subjects.map((s, i) => (
                                      <li key={i} className="truncate">• {s}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => skipMutation.mutate()}>
                  Skip for now
                </Button>
                <Button onClick={() => setStep("cleanup")} disabled={selectedCount === 0}>
                  Next ({selectedCount})
                </Button>
              </div>
            </div>
          )}

          {step === "cleanup" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">What should we do with new mail from these senders?</h3>
                <p className="text-sm text-muted-foreground">
                  Once a message is included in your daily digest, SubsBuzz can clean it out of your inbox so
                  you only see the summary, not the original. You can change this later in Settings.
                </p>
              </div>

              <div className="space-y-2">
                {(Object.entries(CLEANUP_LABELS) as Array<[InboxCleanupAction, { title: string; subtitle: string }]>).map(
                  ([value, label]) => (
                    <Card
                      key={value}
                      className={`cursor-pointer transition-colors ${cleanupAction === value ? "ring-2 ring-primary" : ""}`}
                      onClick={() => setCleanupAction(value)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            checked={cleanupAction === value}
                            onChange={() => setCleanupAction(value)}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium text-sm">{label.title}</div>
                            <div className="text-xs text-muted-foreground">{label.subtitle}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>

              {cleanupAction === "mark_read_label_archive" && (
                <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                  Label name: <span className="font-mono">{labelName}</span> (we'll create it in Gmail if it doesn't
                  exist).
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => setStep("suggestions")}>
                    Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => skipMutation.mutate()}>
                    Skip for now
                  </Button>
                </div>
                <Button onClick={() => setStep("confirming")}>Review & finish</Button>
              </div>
            </div>
          )}

          {step === "confirming" && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-xl font-semibold">Ready to go</h3>
                <p className="text-sm text-muted-foreground">
                  We'll add <strong>{selectedCount}</strong> sender{selectedCount === 1 ? "" : "s"} to your monitored
                  list and apply <strong>{CLEANUP_LABELS[cleanupAction].title.toLowerCase()}</strong> to new mail
                  from them.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <div className="mb-2 font-medium">Selected senders</div>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {newsletters
                    .filter((n) => selections[n.email]?.selected)
                    .map((n) => (
                      <li key={n.email} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {n.suggested_display_name || n.name || n.email}{" "}
                          <span className="text-muted-foreground">— {n.email}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {(() => {
                            const id = selections[n.email]?.categoryId;
                            const cat = (categories as EmailCategory[]).find((c) => c.id === id);
                            return cat?.name ?? "Uncategorized";
                          })()}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("cleanup")}>
                  Back
                </Button>
                <Button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
                  {finishMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    "Finish"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "first_digest" && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <Sparkles className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-2 text-xl font-semibold">Want to see results now?</h3>
                <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                  We can pull the last 3 days of mail from your selected senders and run a digest for you right
                  now — usually finishes in a minute or two. Otherwise the regular run fires at{" "}
                  <span className="font-medium">03:00 UTC</span> daily.
                </p>
              </div>

              <div className="flex flex-col items-center gap-2 pt-2">
                <Button
                  size="lg"
                  className="w-full max-w-xs"
                  onClick={() => runDigestMutation.mutate()}
                  disabled={runDigestMutation.isPending}
                >
                  {runDigestMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting digest…
                    </>
                  ) : (
                    "Yes, run a digest now"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full max-w-xs"
                  onClick={() => setStep("done")}
                  disabled={runDigestMutation.isPending}
                >
                  Skip — I'll wait for the 03:00 UTC run
                </Button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-2xl font-semibold">You're all set</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                {digestRunImmediate ? (
                  <>
                    We've started generating your first digest — it'll appear on the dashboard shortly. After
                    that, the regular run continues at <span className="font-medium">03:00 UTC</span> daily.
                  </>
                ) : (
                  <>
                    Your first digest will be ready at <span className="font-medium">03:00 UTC</span>. You can
                    manage senders and categories any time in Settings.
                  </>
                )}
              </p>
              <Button onClick={onClose}>Go to dashboard</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
