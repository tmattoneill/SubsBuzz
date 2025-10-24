import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

interface GaugeChartProps {
  value: number;
  title?: string;
  label?: string;
  className?: string;
}

const chartConfig = {
  coverage: {
    label: "Digests with insights",
    color: "hsl(var(--chart-2))",
  },
} as const;

export function GaugeChart({ value, title, label, className }: GaugeChartProps) {
  const clampedValue = Math.min(Math.max(Math.round(value ?? 0), 0), 100);
  const chartData = [
    {
      name: "coverage",
      value: clampedValue,
      fill: "var(--color-coverage)",
    },
  ];

  return (
    <Card className={cn(className)}>
      {title ? (
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <div className="relative flex w-full max-w-xs items-center justify-center">
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <RadialBarChart
              data={chartData}
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                background={{ fill: "hsl(var(--muted))" }}
                dataKey="value"
                cornerRadius={12}
                fill="var(--color-coverage)"
              />
            </RadialBarChart>
          </ChartContainer>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-semibold text-foreground">{clampedValue}%</span>
            {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
