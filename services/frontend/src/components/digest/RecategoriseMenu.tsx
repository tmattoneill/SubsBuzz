import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { useCategories } from "@/hooks/useCategories";

interface RecategoriseMenuProps {
  digestEmailId: number;
  currentCategorySlug?: string | null;
  /** Render as a floating icon overlaid on the card vs inline in the metadata bar. */
  variant?: "card-overlay" | "inline";
}

/**
 * Recategorise action on a digest article. Calls the subscription-scoped
 * recategorise endpoint — the new category propagates to every digest_email
 * under the same subscription, not just this one card.
 */
export function RecategoriseMenu({
  digestEmailId,
  currentCategorySlug,
  variant = "inline",
}: RecategoriseMenuProps) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: categories = [] } = useCategories();

  const recategorise = useMutation({
    mutationFn: (categoryId: number | null) =>
      api.patch(`/api/subscriptions/digest-email/${digestEmailId}/recategorise`, { categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/digest"] });
      qc.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Category updated" });
      setOpen(false);
    },
    onError: (err: any) =>
      toast({
        title: "Failed to update category",
        description: err?.message || "Unknown error",
        variant: "destructive",
      }),
  });

  const triggerClass =
    variant === "card-overlay"
      ? "absolute top-4 right-4 size-9 rounded-full bg-white/95 backdrop-blur-sm text-primary"
      : "";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClass}
          aria-label="Recategorise article"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Recategorise to…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {categories.map((c) => {
          const isCurrent = c.slug === currentCategorySlug;
          return (
            <DropdownMenuItem
              key={c.id}
              disabled={recategorise.isPending}
              onSelect={() => recategorise.mutate(c.id)}
            >
              <span className="flex-1">{c.name}</span>
              {isCurrent ? <Check className="h-4 w-4 text-muted-foreground" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={recategorise.isPending}
          onSelect={() => recategorise.mutate(null)}
        >
          Clear category
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
