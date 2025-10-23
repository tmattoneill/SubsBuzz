import { useState, useEffect } from "react";
import { useLocation } from 'wouter';
import { Sidebar } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/ui/page-header";
import { DigestCard } from "@/components/ui/digest-card";
import { useAuth } from '@/lib/AuthContext';
import { DigestEmail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { BookmarkIcon } from "lucide-react";

export default function Favorites() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [favoriteEmails, setFavoriteEmails] = useState<DigestEmail[]>([]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);
  
  // In a real implementation, we would fetch favorites from the API
  useEffect(() => {
    // This is a placeholder for demonstration
    setFavoriteEmails([]);
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8">
        <PageHeader 
          title="Favorite Emails" 
          date={new Date()}
        />
        
        <div className="space-y-6">
          {favoriteEmails.length > 0 ? (
            favoriteEmails.map(email => (
              <DigestCard 
                key={email.id} 
                email={email} 
                onToggleFavorite={() => {}} 
              />
            ))
          ) : (
            <div className="text-center py-12 bg-card rounded-xl shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookmarkIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No favorites yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                When you find emails you want to save for later, mark them as favorites
                and they'll appear here for easy access.
              </p>
              <Button onClick={() => setLocation('/')}>
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-card rounded-xl shadow-sm p-6">
          <div className="text-center py-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Favorites Feature Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're working on implementing the ability to save your favorite emails.
              Soon, you'll be able to mark important emails and access them easily from this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}