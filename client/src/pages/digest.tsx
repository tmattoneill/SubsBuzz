import { useEffect } from "react";
import { useRoute, useLocation } from 'wouter';
import { useQuery } from "@tanstack/react-query";
import { useAuth } from '@/lib/AuthContext';
import { PageHeader } from "@/components/ui/page-header";
import { Sidebar } from "@/components/ui/sidebar";
import { ThematicDigest } from "@/components/ui/thematic-digest";
import { DigestCard } from "@/components/ui/digest-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FullThematicDigest } from "@/lib/types";

export default function DigestView() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/digest/:date');
  
  const date = params?.date;
  
  // Debug logging
  console.log('🔍 DigestView - match:', match);
  console.log('🔍 DigestView - params:', params);
  console.log('🔍 DigestView - date:', date);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Redirect to dashboard if no date parameter
  useEffect(() => {
    if (!date) {
      setLocation('/');
    }
  }, [date, setLocation]);

  // Fetch digest for the specific date
  const { 
    data: digestData,
    isLoading: isDigestLoading,
    isError: isDigestError
  } = useQuery({
    queryKey: [`/api/digest/date/${date}`],
    enabled: !!date,
    refetchOnWindowFocus: false,
  });

  // Loading state
  if (authLoading || isDigestLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading digest...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isDigestError || !digestData) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No digest found for {date}
            </h2>
            <p className="text-muted-foreground mb-6">
              There is no digest available for this date.
            </p>
            <div className="space-x-4">
              <Button variant="outline" onClick={() => setLocation('/')}>
                ← Back to Dashboard
              </Button>
              <Button variant="outline" onClick={() => setLocation('/history')}>
                View History
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const digest = digestData;
  const isThematicDigest = digest.type === 'thematic';
  const digestDate = new Date(digest.date);
  
  // Debug logging
  console.log('🔍 Frontend digest data:', {
    id: digest.id,
    type: digest.type,
    isThematicDigest,
    hasEmails: !!digest.emails,
    emailsLength: digest.emails?.length || 0,
    digestKeys: Object.keys(digest)
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader 
          title="Digest View" 
          date={digestDate}
        />
        
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            Digest for {formatDate(digestDate)}
          </h1>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setLocation('/')}>
              ← Dashboard
            </Button>
            <Button variant="outline" onClick={() => setLocation('/history')}>
              History
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {isThematicDigest ? (
            <ThematicDigest digest={digest as FullThematicDigest} />
          ) : (
            // For regular digests, show all emails
            digest.emails && digest.emails.length > 0 ? (
              digest.emails.map((email: any) => (
                <DigestCard 
                  key={email.id} 
                  email={email}
                />
              ))
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No emails found in this digest.</p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}