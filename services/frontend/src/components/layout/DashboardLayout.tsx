import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UserProfileModal } from "@/components/ui/user-profile-modal";
import { CategorizationBanner } from "@/components/categories/CategorizationBanner";
import { GmailConnectionBanner } from "@/components/layout/GmailConnectionBanner";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerProps?: {
    onSearch?: (query: string) => void;
    onAddClick?: () => void;
  };
}

export function DashboardLayout({
  children,
  className,
  contentClassName,
  headerProps,
}: DashboardLayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-background md:flex", className)}>
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          {...(headerProps ?? {})}
          onMeClick={() => setProfileOpen(true)}
        />
        <GmailConnectionBanner />
        <CategorizationBanner />
        <main className={cn("flex-1 overflow-auto", contentClassName)}>{children}</main>
      </div>
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
