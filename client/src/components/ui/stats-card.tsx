import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DigestStats } from "@/lib/types";
import { Mail, Hash, UserCheck } from "lucide-react";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  iconBgColor: string;
  iconColor: string;
}

export function StatsCard({ icon, label, value, iconBgColor, iconColor }: StatsCardProps) {
  return (
    <Card className="bg-card">
      <CardContent className="pt-6">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full ${iconBgColor} dark:bg-opacity-20 flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-xl font-semibold dark:text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsRowProps {
  stats: DigestStats;
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <StatsCard
        icon={<Mail className="h-5 w-5" />}
        label="Emails Processed"
        value={stats.emailsProcessed}
        iconBgColor="bg-blue-100"
        iconColor="text-primary"
      />
      
      <StatsCard
        icon={<Hash className="h-5 w-5" />}
        label="Topics Identified"
        value={stats.topicsIdentified}
        iconBgColor="bg-green-100"
        iconColor="text-secondary"
      />
      
      <StatsCard
        icon={<UserCheck className="h-5 w-5" />}
        label="Sources Monitored"
        value={stats.sourcesMonitored}
        iconBgColor="bg-purple-100"
        iconColor="text-accent"
      />
    </div>
  );
}
