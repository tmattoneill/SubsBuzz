import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  name: string;
  slug?: string | null;
  color?: string | null;
  className?: string;
  linkable?: boolean;
}

/**
 * Fast Company-style eyebrow label for an article's category. Renders as a
 * small-caps uppercase link when `slug` is provided and `linkable` is true;
 * otherwise a static span.
 */
export function CategoryBadge({ name, slug, color, className, linkable = true }: CategoryBadgeProps) {
  const label = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
        className
      )}
      style={color ? { color } : undefined}
    >
      {name}
    </span>
  );

  if (linkable && slug) {
    return (
      <Link href={`/category/${slug}`} className="hover:opacity-80 transition-opacity">
        {label}
      </Link>
    );
  }
  return label;
}
