import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface PageHeaderProps {
  title: string;
  date?: Date | string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function PageHeader({ 
  title, 
  date, 
  onRefresh,
  isRefreshing = false
}: PageHeaderProps) {

  return (
    <header className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {date && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">{formatDate(date)}</p>
          )}
        </div>
        {onRefresh && (
          <div className="mt-4 md:mt-0">
            <Button 
              className="bg-primary text-white hover:bg-blue-600 transition flex items-center"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
