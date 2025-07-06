import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader } from "@/components/ui/page-header";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ExternalLink, Calendar, Mail, Tag, RefreshCw, Loader2 } from "lucide-react";
import { EmailDigest } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface DigestSummaryCard {
  id: number;
  date: string;
  emailsProcessed: number;
  topicsIdentified: number;
  type: 'regular' | 'thematic';
  sectionsCount?: number;
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Fetch all available digest history
  const { data: digestHistoryResponse, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['/api/digest/history'],
    refetchOnWindowFocus: false,
  });

  // Extract digests array from response
  const digestHistory = Array.isArray(digestHistoryResponse) 
    ? digestHistoryResponse 
    : (digestHistoryResponse?.digests || digestHistoryResponse?.data || []);

  // Fetch available digest dates for additional info
  const { data: availableDates = [] } = useQuery({
    queryKey: ['/api/digest/available-dates'],
    refetchOnWindowFocus: false,
  });

  // Digest generation mutation
  const generateDigestMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/digest/generate', {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Digest Generation Started",
        description: "Your request has been submitted. The digest will appear once processing completes.",
      });
      // Refetch digest data
      queryClient.invalidateQueries({ queryKey: ['/api/digest/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/digest/available-dates'] });
    },
    onError: (error: any) => {
      toast({
        title: "Digest Generation Failed",
        description: error.message || "Failed to generate digest. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create digest summary cards from the history data
  const digestCards: DigestSummaryCard[] = (Array.isArray(digestHistory) ? digestHistory : []).map((digest: EmailDigest) => ({
    id: digest.id,
    date: digest.date,
    emailsProcessed: digest.emailsProcessed,
    topicsIdentified: digest.topicsIdentified,
    type: 'regular', // For now, assume regular (we can enhance this later)
  }));

  // Sort by date (most recent first)
  digestCards.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleViewDigest = (date: string) => {
    const formattedDate = new Date(date).toISOString().split('T')[0];
    setLocation(`/digest/${formattedDate}`);
  };

  // Loading state
  if (authLoading || isHistoryLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your digests...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <PageHeader 
            title="Your Digest Dashboard" 
            date={new Date()}
          />
          <Button
            onClick={() => generateDigestMutation.mutate()}
            disabled={generateDigestMutation.isPending}
            className="flex items-center gap-2"
          >
            {generateDigestMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Generate Digest
              </>
            )}
          </Button>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            All Your Digests
          </h2>
          <p className="text-muted-foreground">
            You have {digestCards.length} digest{digestCards.length !== 1 ? 's' : ''} available. 
            Click any digest to view its full content.
          </p>
        </div>

        {digestCards.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Digests Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Your email digests will appear here once they're processed.
                </p>
                <Button onClick={() => setLocation('/settings')}>
                  Configure Email Sources
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {digestCards.map((digestCard) => (
              <Card 
                key={digestCard.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                onClick={() => handleViewDigest(digestCard.date)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      {formatDate(new Date(digestCard.date))}
                    </CardTitle>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(digestCard.date).toLocaleDateString()}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        Emails Processed
                      </span>
                      <span className="font-medium">{digestCard.emailsProcessed}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center text-muted-foreground">
                        <Tag className="h-3 w-3 mr-1" />
                        Topics Identified
                      </span>
                      <span className="font-medium">{digestCard.topicsIdentified}</span>
                    </div>
                    {digestCard.type === 'thematic' && digestCard.sectionsCount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Thematic Sections</span>
                        <span className="font-medium">{digestCard.sectionsCount}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDigest(digestCard.date);
                      }}
                    >
                      View Full Digest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => setLocation('/history')}>
            View Calendar History
          </Button>
        </div>
      </div>
    </div>
  );
}