import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bookmark } from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { DigestCard } from "@/components/ui/digest-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { DigestEmail } from "@/lib/types";

export default function Favorites() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [favoriteEmails, setFavoriteEmails] = useState<DigestEmail[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    setFavoriteEmails([]);
  }, []);

  return (
    <DashboardLayout headerProps={{ onAddClick: () => setLocation("/settings") }}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Favorite emails</h1>
          <p className="text-sm text-muted-foreground">
            Pin standout updates so you can revisit them without searching your inbox.
          </p>
        </div>

        {favoriteEmails.length > 0 ? (
          <div className="space-y-6">
            {favoriteEmails.map((email) => (
              <DigestCard key={email.id} email={email} onToggleFavorite={() => {}} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-secondary">
              <Bookmark className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No favorites yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              When you favourite a summary it will live here for quick access and follow-up.
            </p>
            <Button className="mt-6" onClick={() => setLocation("/dashboard")}>Back to dashboard</Button>
          </div>
        )}

        <div className="rounded-xl bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Feature roadmap</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re wiring up shared collections so you can bookmark insights and share them with your
            team. Watch this space for updates.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
