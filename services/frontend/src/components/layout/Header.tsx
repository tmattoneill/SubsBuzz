import { Search, SlidersHorizontal, Filter, UserRound, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onFilterClick?: () => void;
  onSortClick?: () => void;
  onAddClick?: () => void;
}

export function Header({ onSearch, onFilterClick, onSortClick, onAddClick }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-6 border-b border-border bg-card px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
        <Input
          type="search"
          placeholder="Search digests, sources, or topics"
          className="pl-10"
          onChange={(event) => onSearch?.(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onSortClick}>
          <SlidersHorizontal className="mr-2 h-4 w-4 text-secondary" />
          Sort
        </Button>
        <Button variant="ghost" size="sm" onClick={onFilterClick}>
          <Filter className="mr-2 h-4 w-4 text-secondary" />
          Filters
        </Button>
        <Button variant="ghost" size="sm">
          <UserRound className="mr-2 h-4 w-4 text-secondary" />
          Me
        </Button>
        <Button variant="default" size="sm" className="gap-2" onClick={onAddClick}>
          <Plus className="h-4 w-4 text-secondary" />
          Add source
        </Button>
      </div>
    </header>
  );
}
