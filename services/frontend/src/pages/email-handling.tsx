import { useEffect } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { DashboardLayout } from "@/components/layout";
import { cn } from "@/lib/utils";
import EmailHandlingSenders from "@/pages/email-handling-senders";
import EmailHandlingCategories from "@/pages/email-handling-categories";

const tabs = [
  { path: "/email-handling/senders", label: "Senders" },
  { path: "/email-handling/categories", label: "Categories" },
];

export default function EmailHandling() {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (location === "/email-handling") {
      navigate("/email-handling/senders", { replace: true });
    }
  }, [location, navigate]);

  return (
    <DashboardLayout contentClassName="p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Email Handling</h1>
          <p className="text-sm text-muted-foreground">
            Manage which senders are monitored and how they are categorized.
          </p>
        </header>

        <nav className="flex items-center gap-1 border-b border-border">
          {tabs.map((tab) => {
            const active = location.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Switch>
          <Route path="/email-handling/senders" component={EmailHandlingSenders} />
          <Route path="/email-handling/categories" component={EmailHandlingCategories} />
        </Switch>
      </div>
    </DashboardLayout>
  );
}
