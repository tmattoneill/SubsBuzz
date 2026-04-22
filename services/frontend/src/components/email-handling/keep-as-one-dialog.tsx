import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { EmailCategory, Subscription } from "@/lib/types";

interface KeepAsOneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderEmail: string;
  senderId: number;
  subscriptions: Subscription[];
  categoryMap: Map<number, EmailCategory>;
}

/**
 * Collapse every subscription under a sender back into a single row.
 * Shown when the parser over-split a sender (e.g. a publisher whose List-Id
 * varies per send). Also sets split_locked on the sender so future messages
 * can't re-split it regardless of List-Id.
 */
export function KeepAsOneDialog({
  open,
  onOpenChange,
  senderEmail,
  senderId,
  subscriptions,
  categoryMap,
}: KeepAsOneDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [keepId, setKeepId] = useState<number | null>(subscriptions[0]?.id ?? null);

  // Reset the default selection whenever the dialog reopens against a new
  // sender — otherwise a stale id from a previous open can leak in.
  useEffect(() => {
    if (open) setKeepId(subscriptions[0]?.id ?? null);
  }, [open, subscriptions]);

  const merge = useMutation({
    mutationFn: (keepSubscriptionId: number) =>
      api.post(`/api/subscriptions/sender/${senderId}/merge`, { keepSubscriptionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
      toast({
        title: "Kept as one",
        description: "This sender won't be split into multiple subscriptions again.",
      });
      onOpenChange(false);
    },
    onError: (err: any) =>
      toast({
        title: "Failed to merge subscriptions",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const handleConfirm = () => {
    if (keepId == null) return;
    merge.mutate(keepId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keep as one</DialogTitle>
          <DialogDescription>
            Collapse every subscription under <span className="font-mono">{senderEmail}</span> back into one.
            We'll stop splitting this sender on future messages. Pick which name and category to keep.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={keepId == null ? undefined : String(keepId)}
          onValueChange={(v) => setKeepId(Number(v))}
          className="py-2"
        >
          {subscriptions.map((sub) => {
            const cat = sub.categoryId ? categoryMap.get(sub.categoryId) : null;
            return (
              <div
                key={sub.id}
                className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/30"
              >
                <RadioGroupItem value={String(sub.id)} id={`keep-${sub.id}`} className="mt-0.5" />
                <Label htmlFor={`keep-${sub.id}`} className="flex-1 cursor-pointer space-y-0.5">
                  <div className="font-medium">{sub.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {cat?.name ?? "Uncategorised"} · {sub.messageCount} message{sub.messageCount === 1 ? "" : "s"}
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merge.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={keepId == null || merge.isPending}>
            {merge.isPending ? "Merging…" : "Keep as one"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
