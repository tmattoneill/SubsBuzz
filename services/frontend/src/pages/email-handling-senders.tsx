import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Merge, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { AddSenderModal } from "@/components/settings/add-sender-modal";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { useCategories } from "@/hooks/useCategories";
import {
  SplitDetectionBanner,
  shouldShowSplitBanner,
} from "@/components/email-handling/split-detection-banner";
import { KeepAsOneDialog } from "@/components/email-handling/keep-as-one-dialog";
import type { MonitoredEmail, EmailCategory, Subscription } from "@/lib/types";

// Smart sender parsing view. A sender's row is flat when it has 0–1
// subscriptions (unchanged from pre-feature UX) and becomes an expandable
// parent row when 2+ subscriptions are present under the same address.
export default function EmailHandlingSenders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<{ sender: MonitoredEmail; subs: Subscription[] } | null>(null);

  const { data: senders = [], isLoading: sendersLoading } = useQuery<MonitoredEmail[]>({
    queryKey: ["/api/monitored-emails"],
    queryFn: () => api.get<MonitoredEmail[]>("/api/monitored-emails"),
  });
  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
    queryFn: () => api.get<Subscription[]>("/api/subscriptions"),
  });
  const { data: categories = [] } = useCategories();

  const categoryMap = useMemo(() => {
    const map = new Map<number, EmailCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Group subscriptions by sender so a single sender with multiple subs
  // renders as an expandable parent. Senders without any subscriptions
  // (pre-feature rows not yet backfilled, or freshly added sender that
  // hasn't produced a digest) still show as flat rows.
  const subsBySender = useMemo(() => {
    const by = new Map<number, Subscription[]>();
    for (const s of subscriptions) {
      const arr = by.get(s.senderId) ?? [];
      arr.push(s);
      by.set(s.senderId, arr);
    }
    return by;
  }, [subscriptions]);

  const updateSenderCategory = useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number | null }) =>
      api.patch(`/api/monitored-emails/${id}`, { categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to update sender",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const updateSubscriptionCategory = useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number | null }) =>
      api.patch(`/api/subscriptions/${id}`, { categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to update subscription",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const deleteSender = useMutation({
    mutationFn: (id: number) => api.delete(`/api/monitored-emails/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Sender removed" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to remove sender",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const deleteSubscription = useMutation({
    mutationFn: (id: number) => api.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Subscription removed" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to remove subscription",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const toggleExpanded = (senderId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(senderId)) next.delete(senderId);
      else next.add(senderId);
      return next;
    });
  };

  const bannersToShow = useMemo(
    () =>
      senders
        .map((s) => ({ sender: s, subs: subsBySender.get(s.id) ?? [] }))
        .filter(({ subs }) => shouldShowSplitBanner(subs))
        .slice(0, 1), // one at a time to avoid UI clutter
    [senders, subsBySender],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Monitored senders</h2>
          <p className="text-sm text-muted-foreground">
            Newsletters and senders pulled into your daily digest.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add sender
        </Button>
      </div>

      {bannersToShow.map(({ sender, subs }) => (
        <SplitDetectionBanner
          key={sender.id}
          senderEmail={sender.email}
          senderId={sender.id}
          subscriptions={subs}
          categoryMap={categoryMap}
          onAdjust={() => {
            setExpanded((prev) => {
              const next = new Set(prev);
              next.add(sender.id);
              return next;
            });
          }}
        />
      ))}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-[260px]">Category</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sendersLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : senders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  No senders yet. Click "Add sender" to start.
                </TableCell>
              </TableRow>
            ) : (
              senders.flatMap((s) => {
                const subs = subsBySender.get(s.id) ?? [];
                const rows: JSX.Element[] = [];

                if (subs.length >= 2) {
                  // Parent row: clickable, summarises "Multiple (N)".
                  const isOpen = expanded.has(s.id);
                  rows.push(
                    <TableRow
                      key={`sender-${s.id}`}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleExpanded(s.id)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {s.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Multiple ({subs.length})
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergeTarget({ sender: s, subs });
                            }}
                            title="Collapse all into one subscription"
                            aria-label={`Keep ${s.email} as one subscription`}
                          >
                            <Merge className="mr-1 h-4 w-4" />
                            Keep as one
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSender.mutate(s.id);
                            }}
                            disabled={deleteSender.isPending}
                            aria-label={`Remove ${s.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>,
                  );

                  if (isOpen) {
                    for (const sub of subs) {
                      rows.push(
                        <TableRow key={`sub-${sub.id}`} className="bg-muted/20">
                          <TableCell className="pl-10 text-sm">
                            <span className="text-muted-foreground">└</span>{" "}
                            <span className="font-medium">{sub.displayName}</span>
                          </TableCell>
                          <TableCell>
                            <CategorySelect
                              value={sub.categoryId ?? null}
                              allowUnset
                              onChange={(categoryId) =>
                                updateSubscriptionCategory.mutate({ id: sub.id, categoryId })
                              }
                              placeholder={
                                sub.categoryId
                                  ? categoryMap.get(sub.categoryId)?.name ?? "Uncategorised"
                                  : "Uncategorised"
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSubscription.mutate(sub.id)}
                              disabled={deleteSubscription.isPending}
                              aria-label={`Remove ${sub.displayName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>,
                      );
                    }
                  }
                } else if (subs.length === 1) {
                  // One subscription — flat row. Category comes from the
                  // subscription (not the sender's legacy categoryId) so
                  // auto-categorisation is visible immediately.
                  const sub = subs[0];
                  const cat = sub.categoryId ? categoryMap.get(sub.categoryId) : null;
                  rows.push(
                    <TableRow key={`sender-${s.id}`}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell>
                        <CategorySelect
                          value={sub.categoryId ?? null}
                          allowUnset
                          onChange={(categoryId) =>
                            updateSubscriptionCategory.mutate({ id: sub.id, categoryId })
                          }
                          placeholder={cat?.name ?? "Uncategorised"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSender.mutate(s.id)}
                          disabled={deleteSender.isPending}
                          aria-label={`Remove ${s.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>,
                  );
                } else {
                  // No subscriptions yet (freshly added sender, no digest run).
                  // Fall back to the legacy sender-level category column.
                  const cat = s.categoryId ? categoryMap.get(s.categoryId) : null;
                  rows.push(
                    <TableRow key={`sender-${s.id}`}>
                      <TableCell className="font-medium">
                        <div>{s.email}</div>
                        <div className="text-xs text-muted-foreground italic">
                          Waiting for first message to refine categorisation
                        </div>
                      </TableCell>
                      <TableCell>
                        <CategorySelect
                          value={s.categoryId ?? null}
                          allowUnset
                          onChange={(categoryId) =>
                            updateSenderCategory.mutate({ id: s.id, categoryId })
                          }
                          placeholder={cat?.name ?? "Uncategorised"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSender.mutate(s.id)}
                          disabled={deleteSender.isPending}
                          aria-label={`Remove ${s.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>,
                  );
                }

                return rows;
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddSenderModal open={isAddOpen} onOpenChange={setIsAddOpen} />
      {mergeTarget ? (
        <KeepAsOneDialog
          open={!!mergeTarget}
          onOpenChange={(open) => {
            if (!open) setMergeTarget(null);
          }}
          senderEmail={mergeTarget.sender.email}
          senderId={mergeTarget.sender.id}
          subscriptions={mergeTarget.subs}
          categoryMap={categoryMap}
        />
      ) : null}
    </section>
  );
}
