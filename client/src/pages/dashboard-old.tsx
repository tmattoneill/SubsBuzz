import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/lib/AuthContext';
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats-card";
import { TopicFilter } from "@/components/ui/topic-filter";
import { DigestCard } from "@/components/ui/digest-card";
import { ThematicDigest } from "@/components/ui/thematic-digest";
import { Pagination } from "@/components/ui/pagination";
import { ConfigModal } from "@/components/ui/config-modal";
import { OnboardingModal } from "@/components/ui/onboarding-modal";
import { Sidebar } from "@/components/ui/sidebar";
import { DigestStats, Topic, DigestEmail, EmailDigest, MonitoredEmail, UserSettings, FullThematicDigest } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const itemsPerPage = 5;
  
  // Get URL search params to detect date parameter
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const selectedDate = urlParams.get('date');
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  // Fetch digest data - either latest or specific date
  const { 
    data: digestData,
    isLoading: isDigestLoading,
    isError: isDigestError,
    refetch: refetchDigest,
    isFetching: isRefetching
  } = useQuery({
    queryKey: selectedDate ? ['/api/digest/date', selectedDate] : ['/api/digest/latest'],
    refetchOnWindowFocus: false,
  });

  // Fetch monitored emails
  const { 
    data: monitoredEmailsData,
    isLoading: isMonitoredEmailsLoading,
    refetch: refetchMonitoredEmails
  } = useQuery({
    queryKey: ['/api/monitored-emails'],
    refetchOnWindowFocus: false,
  });

  // Fetch user settings
  const { 
    data: userSettingsData,
    isLoading: isUserSettingsLoading,
    refetch: refetchUserSettings
  } = useQuery({
    queryKey: ['/api/settings'],
    refetchOnWindowFocus: false,
  });

  // Check if user needs onboarding (no monitored emails)
  useEffect(() => {
    if (monitoredEmailsData && !isMonitoredEmailsLoading) {
      const monitoredEmails: MonitoredEmail[] = (monitoredEmailsData as MonitoredEmail[]) || [];
      if (monitoredEmails.length === 0) {
        setShowOnboarding(true);
      }
    }
  }, [monitoredEmailsData, isMonitoredEmailsLoading]);
  
  // Add email mutation
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest('POST', '/api/monitored-emails', { email });
    },
    onSuccess: () => {
      toast({
        title: "Email added successfully",
        description: "The email address will be monitored for future digests.",
      });
      refetchMonitoredEmails();
    },
    onError: (error) => {
      toast({
        title: "Failed to add email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove email mutation
  const removeEmailMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/monitored-emails/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Email removed successfully",
        description: "The email address has been removed from monitoring.",
      });
      refetchMonitoredEmails();
    },
    onError: (error) => {
      toast({
        title: "Failed to remove email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      await apiRequest('PATCH', '/api/settings', settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings updated successfully",
      });
      refetchUserSettings();
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refresh digest mutation
  const refreshDigestMutation = useMutation({
    mutationFn: async () => {
      // Session-based auth - no need for ID token
      const response = await apiRequest('POST', '/api/digest/generate', {});
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.message === "No new emails from sender found in inbox") {
        toast({
          title: data.message,
          variant: "info",
        });
      } else {
        toast({
          title: "Digest refreshed successfully",
        });
      }
      refetchDigest();
    },
    onError: (error) => {
      toast({
        title: "Failed to refresh digest",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Gmail connection mutation
  const connectGmailMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in");
      
      const response = await fetch('/api/auth/gmail-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'session-auth' })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data && data.authUrl) {
        // Show notification before redirecting
        toast({
          title: "Connecting to Gmail",
          description: "You'll be redirected to Google to authorize access to your inbox.",
        });
        
        // Open Google's authorization page in a new tab
        console.log("Opening auth URL:", data.authUrl);
        window.open(data.authUrl, '_blank');
      } else {
        toast({
          title: "Gmail connected",
          description: "Successfully connected to your Gmail account. Refreshing digest with real data...",
        });
        refreshDigestMutation.mutate();
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to connect to Gmail",
        description: error.message || "Could not connect to Gmail. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check if we have a thematic digest or regular digest
  const isThematicDigest = digestData && 'sections' in digestData;
  
  // Extract digest data with proper type handling
  const defaultDigest: EmailDigest = {
    id: 0,
    date: new Date().toISOString(),
    emailsProcessed: 0,
    topicsIdentified: 0,
    emails: []
  };
  
  let digest: EmailDigest;
  let thematicDigest: FullThematicDigest | null = null;
  
  if (isThematicDigest) {
    // We have a thematic digest
    thematicDigest = digestData as FullThematicDigest;
    // Create a compatible digest object for stats
    digest = {
      id: thematicDigest.id,
      date: thematicDigest.date,
      emailsProcessed: thematicDigest.totalSourceEmails,
      topicsIdentified: thematicDigest.sectionsCount,
      emails: [] // No individual emails in thematic view
    };
  } else {
    // Regular digest
    digest = digestData ? digestData as EmailDigest : defaultDigest;
    // Ensure emails array exists
    if (!digest.emails) {
      digest.emails = [];
    }
  }

  // Extract monitored emails with proper type handling
  const defaultEmails: MonitoredEmail[] = [];
  const monitoredEmails: MonitoredEmail[] = monitoredEmailsData ? monitoredEmailsData as MonitoredEmail[] : defaultEmails;

  // Extract user settings with proper type handling
  const defaultSettings: UserSettings = {
    id: 0,
    dailyDigestEnabled: true,
    topicClusteringEnabled: true,
    emailNotificationsEnabled: false
  };
  const userSettings: UserSettings = userSettingsData ? userSettingsData as UserSettings : defaultSettings;

  // Generate stats
  const stats: DigestStats = {
    emailsProcessed: digest.emailsProcessed,
    topicsIdentified: digest.topicsIdentified,
    sourcesMonitored: monitoredEmails.length
  };

  // Extract all unique topics from emails or thematic sections
  const extractTopics = (): Topic[] => {
    if (isThematicDigest && thematicDigest) {
      // Extract topics from thematic sections
      return thematicDigest.sections.map(section => ({
        name: section.theme,
        isSelected: selectedTopics.includes(section.theme)
      }));
    } else if (digest.emails && digest.emails.length > 0) {
      // Extract topics from individual emails
      const topicCounts: Record<string, number> = {};
      digest.emails.forEach(email => {
        email.topics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      });

      return Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => ({
          name,
          isSelected: selectedTopics.includes(name)
        }));
    }
    
    return [];
  };

  // Filter emails by selected topics
  const filteredEmails = digest.emails.filter(email => {
    if (selectedTopics.length === 0) return true;
    return email.topics.some(topic => selectedTopics.includes(topic));
  });

  // Paginate emails
  const paginatedEmails = filteredEmails.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage);

  // Handle topic selection
  const handleTopicSelect = (topicName: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicName)) {
        return prev.filter(t => t !== topicName);
      } else {
        return [...prev, topicName];
      }
    });
    setCurrentPage(1); // Reset to first page when filtering changes
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle refresh
  const handleRefresh = () => {
    refreshDigestMutation.mutate();
  };

  // Toggle favorite
  const handleToggleFavorite = (id: number) => {
    // This would be implemented with a backend API call in a real app
    console.log(`Toggle favorite for email ${id}`);
  };

  // Add email
  const handleAddEmail = (email: string) => {
    addEmailMutation.mutate(email);
  };

  // Remove email
  const handleRemoveEmail = (id: number) => {
    removeEmailMutation.mutate(id);
  };

  // Update settings
  const handleUpdateSettings = (settings: Partial<UserSettings>) => {
    updateSettingsMutation.mutate(settings);
  };

  // Get all unique topics
  const topics = extractTopics();

  if (isDigestLoading || isMonitoredEmailsLoading || isUserSettingsLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-8 w-1/5"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-card rounded-xl shadow-sm"></div>
              ))}
            </div>
            
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/6"></div>
            <div className="flex flex-wrap gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
              ))}
            </div>
            
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-card rounded-xl shadow-sm mb-6"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isDigestError) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 flex items-center justify-center max-w-4xl mx-auto">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">Failed to load digest</h2>
            <p className="text-muted-foreground mb-4">There was an error loading your email digest.</p>
            <Button onClick={() => refetchDigest()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto">
        <PageHeader 
          title={selectedDate ? "Historical Digest" : "Your Daily Digest"} 
          date={digest.date}
          onRefresh={handleRefresh}
          isRefreshing={refreshDigestMutation.isPending || isRefetching}
        />
        
        {selectedDate && (
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => setLocation('/')}
              className="text-sm"
            >
              ← Back to Latest Digest
            </Button>
          </div>
        )}
        
        <StatsRow stats={stats} />
        
        <TopicFilter 
          topics={topics} 
          onTopicSelect={handleTopicSelect} 
        />
        
        <div className="space-y-6">
          {isThematicDigest && thematicDigest ? (
            // Render thematic digest
            <ThematicDigest digest={thematicDigest} />
          ) : paginatedEmails.length > 0 ? (
            // Render individual email cards
            paginatedEmails.map(email => (
              <DigestCard 
                key={email.id} 
                email={email} 
                onToggleFavorite={handleToggleFavorite} 
              />
            ))
          ) : (
            // No content to display
            <div className="text-center py-12 bg-card rounded-xl shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">No digest to display</h3>
              <p className="text-muted-foreground">
                {selectedTopics.length > 0 
                  ? "Try selecting different topics or clearing your filters."
                  : "No emails have been processed yet."}
              </p>
            </div>
          )}
        </div>
        
        {!isThematicDigest && paginatedEmails.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredEmails.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        )}
      </div>
      
      <ConfigModal 
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        monitoredEmails={monitoredEmails}
        userSettings={userSettings}
        onAddEmail={handleAddEmail}
        onRemoveEmail={handleRemoveEmail}
        onUpdateSettings={handleUpdateSettings}
      />
      
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          refetchMonitoredEmails();
          refetchDigest();
        }}
      />
    </div>
  );
}
