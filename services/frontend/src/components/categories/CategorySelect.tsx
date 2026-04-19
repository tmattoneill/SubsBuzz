import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";

interface CategorySelectProps {
  value: number | null | undefined;
  onChange: (categoryId: number | null) => void;
  placeholder?: string;
  allowUnset?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown bound to the user's categories (lazy-seeded on first read).
 * `allowUnset=true` adds an "Uncategorized" entry that clears the assignment.
 */
export function CategorySelect({
  value,
  onChange,
  placeholder = "Choose a category",
  allowUnset = false,
  disabled = false,
  className,
}: CategorySelectProps) {
  const { data: categories, isLoading } = useCategories();

  return (
    <Select
      value={value != null ? String(value) : "__unset"}
      onValueChange={(raw) => onChange(raw === "__unset" ? null : Number(raw))}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowUnset ? <SelectItem value="__unset">Uncategorized</SelectItem> : null}
        {(categories ?? []).map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
