import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerProps?: {
    onSearch?: (query: string) => void;
    onFilterClick?: () => void;
    onSortClick?: () => void;
    onAddClick?: () => void;
  };
}

export function DashboardLayout({
  children,
  className,
  contentClassName,
  headerProps,
}: DashboardLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background md:flex", className)}>
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header {...(headerProps ?? {})} />
        <main className={cn("flex-1 overflow-auto", contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
