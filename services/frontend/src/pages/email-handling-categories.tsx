import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/useCategories";
import type { EmailCategory } from "@/lib/types";

const SWATCHES = [
  "#64748b", // slate
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

function Swatch({
  color,
  selected,
  onClick,
}: {
  color: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 w-6 rounded-full border transition",
        selected ? "ring-2 ring-offset-2 ring-primary" : "border-border hover:scale-110"
      )}
      style={color ? { backgroundColor: color } : undefined}
      aria-label={color ?? "no color"}
    >
      {color == null ? <X className="h-3 w-3 mx-auto text-muted-foreground" /> : null}
    </button>
  );
}

function CategoryRow({ cat }: { cat: EmailCategory }) {
  const { toast } = useToast();
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [color, setColor] = useState<string | null>(cat.color ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await update.mutateAsync({ id: cat.id, name: trimmed, color });
      setEditing(false);
    } catch (err: any) {
      toast({
        title: "Failed to update category",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  const remove = async () => {
    try {
      await del.mutateAsync(cat.id);
      toast({ title: "Category deleted" });
      setConfirmOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to delete category",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
            autoFocus
          />
          <div className="flex-1" />
          <Button size="sm" onClick={save} disabled={update.isPending || !name.trim()}>
            <Check className="mr-1 h-4 w-4" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(cat.name);
              setColor(cat.color ?? null);
            }}
          >
            Cancel
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-2">Color</span>
          <Swatch color={null} selected={color == null} onClick={() => setColor(null)} />
          {SWATCHES.map((c) => (
            <Swatch key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Slug <span className="font-mono">{cat.slug}</span> is immutable — URL stays stable if you rename.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
      <span
        aria-hidden
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
        style={cat.color ? { backgroundColor: cat.color } : undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{cat.name}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">{cat.slug}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirmOpen(true)}
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Senders in this category become uncategorized. Historical digest articles keep
              their frozen category label for the collection view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={del.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EmailHandlingCategories() {
  const { toast } = useToast();
  const { data: categories = [], isLoading } = useCategories();
  const create = useCreateCategory();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({ name, color: newColor });
      setNewName("");
      setNewColor(null);
      setCreating(false);
    } catch (err: any) {
      toast({
        title: "Failed to create category",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Labels used to group senders and filter digests. Renaming keeps the URL slug stable.
          </p>
        </div>
        {!creating ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add category
          </Button>
        ) : null}
      </div>

      {creating ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-xs"
              autoFocus
            />
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={submitCreate}
              disabled={create.isPending || !newName.trim()}
            >
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewColor(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">Color</span>
            <Swatch
              color={null}
              selected={newColor == null}
              onClick={() => setNewColor(null)}
            />
            {SWATCHES.map((c) => (
              <Swatch
                key={c}
                color={c}
                selected={newColor === c}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          categories.map((c) => <CategoryRow key={c.id} cat={c} />)
        )}
      </div>
    </section>
  );
}
