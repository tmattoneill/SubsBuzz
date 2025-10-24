import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ChartDataPoint } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface BarChartProps {
  data: ChartDataPoint[];
  title?: string;
  description?: string;
  className?: string;
}

const chartConfig = {
  value: {
    label: "Emails processed",
    color: "hsl(var(--chart-1))",
  },
} as const;

export function BarChart({ data, title, description, className }: BarChartProps) {
  const hasData = useMemo(() => data.some((item) => item.value > 0), [data]);

  return (
    <Card className={cn(className)}>
      {(title || description) && (
        <CardHeader>
          {title ? <CardTitle className="text-base font-semibold">{title}</CardTitle> : null}
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </CardHeader>
      )}
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={30}
                className="text-xs"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                fill="var(--color-value)"
                fillOpacity={0.15}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No recent email activity.</p>
            <p className="text-xs">Digests will populate this chart once processing completes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
