import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UserProfileModal } from "@/components/ui/user-profile-modal";
import { CategorizationBanner } from "@/components/categories/CategorizationBanner";
import { GmailConnectionBanner } from "@/components/layout/GmailConnectionBanner";
import { OnboardingModal } from "@/components/ui/onboarding-modal";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api-client";
import type { MonitoredEmail, UserSettings } from "@/lib/types";
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const { user } = useAuth();

  // Onboarding gate (TEEPER-208). Only run while authed; both queries
  // tolerate failure — if either lookup errors, we leave the modal closed.
  const { data: senders } = useQuery<MonitoredEmail[]>({
    queryKey: ["/api/monitored-emails"],
    queryFn: () => api.get<MonitoredEmail[]>("/api/monitored-emails"),
    enabled: !!user,
    staleTime: 30_000,
  });
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    queryFn: () => api.get<UserSettings>("/api/settings"),
    enabled: !!user,
    staleTime: 30_000,
  });

  const sendersCount = Array.isArray(senders) ? senders.length : null;
  const showOnboarding =
    !onboardingDismissed &&
    !!user &&
    sendersCount === 0 &&
    !settings?.onboardingCompletedAt &&
    !settings?.onboardingDismissedAt;

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
      <OnboardingModal isOpen={showOnboarding} onClose={() => setOnboardingDismissed(true)} />
    </div>
  );
}
