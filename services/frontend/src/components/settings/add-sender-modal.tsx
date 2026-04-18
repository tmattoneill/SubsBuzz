import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { CategorySelect } from "@/components/categories/CategorySelect";
import { useCreateCategory } from "@/hooks/useCategories";
import type { MonitoredEmail } from "@/lib/types";

interface AddSenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddSenderModal({ open, onOpenChange }: AddSenderModalProps) {
  const [email, setEmail] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const createCategory = useCreateCategory();

  const addSender = useMutation({
    mutationFn: (input: { email: string; categoryId: number }) =>
      api.post<MonitoredEmail>("/api/monitored-emails", {
        email: input.email,
        active: true,
        categoryId: input.categoryId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/monitored-emails"] });
      toast({ title: "Sender added" });
      setEmail("");
      setCategoryId(null);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add sender",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!email || categoryId == null) {
      toast({ title: "Missing fields", description: "Email and category are required." });
      return;
    }
    addSender.mutate({ email, categoryId });
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const created = await createCategory.mutateAsync({ name });
      setCategoryId(created.id);
      setNewCategoryName("");
      setShowCreate(false);
    } catch (err: any) {
      toast({
        title: "Failed to create category",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add sender</DialogTitle>
          <DialogDescription>
            Monitor a new newsletter sender and assign it to a category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sender-email">Email address</Label>
            <Input
              id="sender-email"
              type="email"
              placeholder="newsletter@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <CategorySelect value={categoryId} onChange={setCategoryId} />
            {!showCreate ? (
              <button
                type="button"
                className="text-xs text-muted-foreground underline hover:text-foreground"
                onClick={() => setShowCreate(true)}
              >
                + Create new category
              </button>
            ) : (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || createCategory.isPending}
                >
                  Create
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewCategoryName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={addSender.isPending}>
            {addSender.isPending ? "Adding…" : "Add sender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
