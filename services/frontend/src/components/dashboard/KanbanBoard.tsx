import { ArrowUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DigestKanbanColumn } from "@/lib/types";
import { DigestCard } from "@/components/dashboard/digest-card";

interface KanbanBoardProps {
  columns: DigestKanbanColumn[];
  onCardClick?: (dateISO: string) => void;
}

export function KanbanBoard({ columns, onCardClick }: KanbanBoardProps) {
  return (
    <div className="flex h-[calc(100vh-18rem)] gap-4">
      {columns.map((column) => (
        <div key={column.id} className="flex min-w-[280px] flex-1 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{column.title}</h2>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                {column.count}
              </span>
              <button className="rounded p-1 transition-colors hover:bg-muted">
                <ArrowUpDown className="h-3.5 w-3.5 text-secondary" />
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {column.cards.map((card) => (
                <DigestCard
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick?.(card.dateISO)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
