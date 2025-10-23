import { useState, useEffect } from "react";
import { useLocation } from 'wouter';
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/utils";
import { ThematicDigest } from "@/components/ui/thematic-digest";
import { DigestCard } from "@/components/ui/digest-card";
import { EmailDigest, FullThematicDigest } from "@/lib/types";

export default function History() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Fetch digest history
  const { data: digestHistory = [] } = useQuery({
    queryKey: ['/api/digest/history'],
    refetchOnWindowFocus: false,
  });

  // Fetch available digest dates for calendar highlighting
  const { data: availableDatesResponse } = useQuery({
    queryKey: ['/api/digest/available-dates'],
    refetchOnWindowFocus: false,
  });

  // Extract dates array from response
  const availableDates = Array.isArray(availableDatesResponse) 
    ? availableDatesResponse 
    : (availableDatesResponse?.dates || []);

  // Fetch digest for selected date
  const { data: selectedDateDigest, isLoading: isLoadingDateDigest } = useQuery({
    queryKey: ['/api/digest/date', date?.toISOString().split('T')[0]],
    enabled: !!date,
    refetchOnWindowFocus: false,
  });
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8">
        <PageHeader 
          title="Digest History" 
          date={date}
        />
        
        <div className="bg-card rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Select a date to view past digests</h2>
          <div className="max-w-sm mx-auto">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  // Navigate to dedicated digest view page
                  const dateStr = selectedDate.toISOString().split('T')[0];
                  setLocation(`/digest/${dateStr}`);
                }
              }}
              className="rounded-md border"
              disabled={(date) => {
                // Disable future dates and dates without digests
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                if (date > today) return true;
                
                // Check if there's a digest for this date using the available dates list
                const dateStr = date.toISOString().split('T')[0];
                return !availableDates.includes(dateStr);
              }}
            />
          </div>
          
          {date && (
            <div className="mt-6 text-center">
              <p className="mb-3">Selected date: <strong>{formatDate(date)}</strong></p>
              {isLoadingDateDigest ? (
                <p className="text-muted-foreground">Loading digest...</p>
              ) : selectedDateDigest ? (
                <p className="text-green-600 dark:text-green-400">✓ Digest available for this date</p>
              ) : (
                <p className="text-muted-foreground">No digest found for this date</p>
              )}
            </div>
          )}
        </div>
        
        {selectedDateDigest ? (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-foreground">Digest for {formatDate(date!)}</h3>
            {selectedDateDigest.type === 'thematic' ? (
              <ThematicDigest digest={selectedDateDigest as FullThematicDigest} />
            ) : (
              <DigestCard digest={selectedDateDigest} />
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-sm p-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-foreground mb-2">Your Digest History</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                You have {digestHistory.length} digest{digestHistory.length !== 1 ? 's' : ''} in your history. 
                Select a date above to view a specific digest.
              </p>
              {digestHistory.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Recent Digests:</h4>
                  <div className="space-y-2 max-w-md mx-auto">
                    {digestHistory.slice(0, 5).map((digest: EmailDigest) => (
                      <div 
                        key={digest.id} 
                        className="flex justify-between items-center p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                        onClick={() => {
                          // Navigate to dedicated digest view page
                          const dateStr = new Date(digest.date).toISOString().split('T')[0];
                          setLocation(`/digest/${dateStr}`);
                        }}
                      >
                        <span>{formatDate(new Date(digest.date))}</span>
                        <span className="text-sm text-muted-foreground">
                          {digest.emailsProcessed} emails, {digest.topicsIdentified} topics
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="outline" onClick={() => setLocation('/')} className="mt-4">
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}