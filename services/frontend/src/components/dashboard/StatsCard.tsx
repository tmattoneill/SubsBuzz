import { ReactNode } from "react";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  actionLabel,
  onActionClick,
  icon,
  className,
}: StatsCardProps) {
  const TrendIcon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : null;

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              {icon}
              <span>{title}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold text-foreground">{value}</span>
              {trend && trend !== "neutral" && trendValue ? (
                <Badge variant={trend === "down" ? "destructive" : "secondary"} className="gap-1">
                  {TrendIcon ? <TrendIcon className="h-3 w-3" /> : null}
                  {trendValue}
                </Badge>
              ) : null}
            </div>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actionLabel ? (
            <button
              onClick={onActionClick}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-muted hover:text-foreground"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
