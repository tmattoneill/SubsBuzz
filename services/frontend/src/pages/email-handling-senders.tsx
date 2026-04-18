import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
import type { MonitoredEmail, EmailCategory } from "@/lib/types";

// TEEPER-40: full redesign (search, filter, bulk actions) deferred — this view only
// adds the category column + inline reassignment + add-sender modal trigger.
export default function EmailHandlingSenders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: senders = [], isLoading } = useQuery<MonitoredEmail[]>({
    queryKey: ["/api/monitored-emails"],
    queryFn: () => api.get<MonitoredEmail[]>("/api/monitored-emails"),
  });
  const { data: categories = [] } = useCategories();

  const categoryMap = useMemo(() => {
    const map = new Map<number, EmailCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const updateSender = useMutation({
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

  const deleteSender = useMutation({
    mutationFn: (id: number) => api.delete(`/api/monitored-emails/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
      toast({ title: "Sender removed" });
    },
    onError: (err: any) =>
      toast({
        title: "Failed to remove sender",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

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

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-[260px]">Category</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
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
              senders.map((s) => {
                const cat = s.categoryId ? categoryMap.get(s.categoryId) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>
                      <CategorySelect
                        value={s.categoryId ?? null}
                        allowUnset
                        onChange={(categoryId) =>
                          updateSender.mutate({ id: s.id, categoryId })
                        }
                        placeholder={cat?.name ?? "Uncategorized"}
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
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddSenderModal open={isAddOpen} onOpenChange={setIsAddOpen} />
    </section>
  );
}
