import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Newspaper,
  CalendarDays,
  Menu,
  X,
  Inbox,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCategories } from "@/hooks/useCategories";

const navItems = [
  {
    title: "Digest",
    path: "/digest",
    icon: Newspaper,
  },
  {
    title: "History",
    path: "/history",
    icon: CalendarDays,
  },
  {
    title: "Email Handling",
    path: "/email-handling/senders",
    icon: Inbox,
  },
];


function NavItem({ title, path, icon: Icon }: typeof navItems[number]) {
  const [location] = useLocation();
  const isActive = path.startsWith("/email-handling")
    ? location.startsWith("/email-handling")
    : path === "/digest"
    ? location.startsWith("/digest")
    : location === path || location.startsWith(`${path}/`);

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
    </Link>
  );
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [location, navigate] = useLocation();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { data: categories = [] } = useCategories();

  const { data: settingsData } = useQuery<any>({
    queryKey: ["/api/settings"],
    select: (data: any) => data?.data ?? data,
  });
  const firstName = settingsData?.firstName ?? "";
  const lastName = settingsData?.lastName ?? "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || user?.email || "SubsBuzz Member";
  const initials = firstName || lastName
    ? `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
    : (user?.email?.[0] ?? "S").toUpperCase();

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
      <div className="mb-6">
        <img src="/logo-banner-bk.png" alt="SubsBuzz" className="h-auto w-44 object-contain dark:hidden" />
        <img src="/logo-banner-wt.png" alt="SubsBuzz" className="h-auto w-44 object-contain hidden dark:block" />
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.path} {...item} />
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
              {categories.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No categories yet.
                </p>
              ) : (
                categories.map((cat) => {
                  const href = `/category/${cat.slug}`;
                  const active = location === href;
                  return (
                    <Link
                      key={cat.id}
                      href={href}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/40"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{cat.name}</span>
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </ScrollArea>

      <div className="mt-6 rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={user?.photoURL ?? ""} alt={displayName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? "hello@subsbuzz.com"}</p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => setShowLogoutDialog(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again with Google to access your digests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );

  if (!isMobile) {
    return sidebarSurface;
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <img
          src="/logo.png"
          alt="SubsBuzz"
          className="h-9 w-9 rounded-lg object-contain"
        />
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
