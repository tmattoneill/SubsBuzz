import {
  CalendarDays,
  MessageCircle,
  Paperclip,
  PanelsTopLeft,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DigestKanbanCard } from "@/lib/types";

interface DigestCardProps {
  card: DigestKanbanCard;
  onClick?: () => void;
}

export function DigestCard({ card, onClick }: DigestCardProps) {
  const highlight = card.isHighlighted || card.type === "thematic";

  return (
    <Card
      className={cn(
        "cursor-pointer border border-border bg-card p-4 transition-all hover:shadow-md",
        highlight && "bg-primary text-primary-foreground"
      )}
      onClick={onClick}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className={cn("text-base font-semibold", highlight ? "text-primary-foreground" : "text-foreground")}
          >
            {card.title}
          </h3>
          <p className={cn("text-sm", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}
          >
            {card.description}
          </p>
        </div>
        {highlight ? <Sparkles className="h-4 w-4 text-accent" /> : null}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className={cn("flex items-center gap-2", highlight ? "text-primary-foreground/90" : "text-foreground")}
        >
          <CalendarDays className="h-3.5 w-3.5 text-secondary" />
          <span>{card.dateLabel}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("flex items-center gap-1", highlight ? "text-primary-foreground" : "text-foreground")}
          >
            <MessageCircle className="h-3.5 w-3.5 text-secondary" />
            <span>{card.topicsIdentified} topics</span>
          </div>
          <div className={cn("flex items-center gap-1", highlight ? "text-primary-foreground" : "text-foreground")}
          >
            <Paperclip className="h-3.5 w-3.5 text-secondary" />
            <span>{card.emailsProcessed} emails</span>
          </div>
        </div>
        {card.sectionsCount ? (
          <div className={cn("flex items-center gap-2 text-xs", highlight ? "text-primary-foreground" : "text-muted-foreground")}
          >
            <PanelsTopLeft className="h-3 w-3 text-secondary" />
            <span>{card.sectionsCount} thematic sections</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
