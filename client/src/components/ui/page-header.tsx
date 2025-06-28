import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { RefreshCw, Search } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  return (
    <header className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {date && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">{formatDate(date)}</p>
          )}
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search digests..."
              className="pl-10 pr-4 py-2 w-full md:w-64 dark:bg-gray-800 dark:text-white dark:border-gray-700"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
          </div>
          {onRefresh && (
            <Button 
              className="bg-primary text-white hover:bg-blue-600 transition flex items-center"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
