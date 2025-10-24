import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CalendarDays,
  Star,
  Settings,
  Signal,
  MailPlus,
  Menu,
  X,
  RefreshCw,
  Bot,
  Lightbulb,
  Archive,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: Sparkles,
  },
  {
    title: "History",
    path: "/history",
    icon: CalendarDays,
  },
  {
    title: "Favorites",
    path: "/favorites",
    icon: Star,
  },
  {
    title: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

const collections = [
  { name: "This Week", metric: "12 digests" },
  { name: "AI & SaaS", metric: "7 sources" },
  { name: "Investing", metric: "5 sources" },
  { name: "Deep Dives", metric: "Focus" },
];

const automation: Array<{
  name: string;
  role: string;
  status: "online" | "idle" | "offline";
  icon: LucideIcon;
}> = [
  { name: "Automation", role: "Digest worker", status: "online", icon: Bot },
  { name: "Insights", role: "Summaries", status: "online", icon: Lightbulb },
  { name: "Archives", role: "History", status: "idle", icon: Archive },
];

function NavItem({ title, path, icon: Icon, badge }: typeof navItems[number] & { badge?: string }) {
  const [location] = useLocation();
  const isActive = location === path || location.startsWith(`${path}/`);

  return (
    <Link
      href={path}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      <Icon className="h-4 w-4 text-secondary" />
      <span className="flex-1">{title}</span>
      {badge && (
        <Badge
          variant="secondary"
          className="h-5 min-w-5 shrink-0 items-center justify-center px-1 text-xs"
        >
          {badge}
        </Badge>
      )}
    </Link>
  );
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const sidebarSurface = (
    <aside className="flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MailPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SubsBuzz</p>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Digest Control</h1>
          </div>
        </div>
        {!isMobile ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-dashed"
            onClick={() => navigate("/dashboard")}
          >
            <RefreshCw className="h-4 w-4" />
            New digest
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.path} {...item} badge={item.path === "/history" ? "beta" : undefined} />
          ))}
        </nav>

        <div className="mt-8 space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Collections
              </span>
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                curated
              </Badge>
            </div>
            <div className="space-y-1">
              {collections.map((item) => (
                <button
                  key={item.name}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent/40"
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.metric}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Automation
              </span>
              <Signal className="h-4 w-4 text-secondary" />
            </div>
            <div className="space-y-2">
              {automation.map((member) => (
                <div
                  key={member.name}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-sidebar-accent/40"
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9 border border-sidebar-border">
                      <AvatarImage src="" alt={member.name} />
                      <AvatarFallback className="bg-muted text-secondary">
                        <member.icon className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar",
                        member.status === "online" && "bg-green-500",
                        member.status === "idle" && "bg-yellow-500",
                        member.status === "offline" && "bg-gray-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="mt-6 rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user?.photoURL ?? ""} alt={user?.displayName ?? "Digest owner"} />
            <AvatarFallback>{user?.displayName?.slice(0, 2).toUpperCase() ?? "SB"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-sidebar-foreground">
              {user?.displayName ?? "SubsBuzz Member"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email ?? "hello@subsbuzz.com"}</p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleSignOut}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );

  if (!isMobile) {
    return sidebarSurface;
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MailPlus className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SubsBuzz</p>
            <p className="text-sm font-semibold text-foreground">Digest Control</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <div className="relative h-full w-72 max-w-full shadow-2xl">
            <div className="flex h-full flex-col bg-sidebar">
              <div className="flex items-center justify-between border-b border-sidebar-border p-4">
                <h2 className="text-sm font-semibold text-sidebar-foreground">Navigation</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {sidebarSurface}
            </div>
          </div>
          <div
            className="flex-1 bg-black/40"
            role="presentation"
            onClick={() => setIsOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
