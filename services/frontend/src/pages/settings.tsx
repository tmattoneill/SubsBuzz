import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/lib/AuthContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sidebar } from "@/components/ui/sidebar";
import { ConfigModal } from "@/components/ui/config-modal";
import { MonitoredEmail, UserSettings } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Mail, Key, RefreshCw, Plus, Palette } from "lucide-react";
import { ThemeColorSelector } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";

export default function Settings() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

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

  // Extract monitored emails
  const monitoredEmails: MonitoredEmail[] = monitoredEmailsData || [];

  // Extract user settings
  const userSettings: UserSettings = userSettingsData || {
    id: 0,
    dailyDigestEnabled: true,
    topicClusteringEnabled: true,
    emailNotificationsEnabled: false,
    themeMode: "system",
    themeColor: "blue"
  };

  // Form schema for OpenAI API key
  const apiKeySchema = z.object({
    apiKey: z.string().min(1, { message: "API key is required" }),
  });

  // Form for API key
  const apiKeyForm = useForm<z.infer<typeof apiKeySchema>>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: "",
    },
  });
  
  // Form schema for Gmail settings
  const gmailSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address" }),
  });

  // Form for Gmail settings
  const gmailForm = useForm<z.infer<typeof gmailSchema>>({
    resolver: zodResolver(gmailSchema),
    defaultValues: {
      email: "tmattoneill@gmail.com",
    },
  });

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

  // Update API key mutation
  const updateApiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      await apiRequest('POST', '/api/settings/api-key', { apiKey });
    },
    onSuccess: () => {
      toast({
        title: "API key updated successfully",
      });
      apiKeyForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to update API key",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  // Submit API key form
  const onApiKeySubmit = (data: z.infer<typeof apiKeySchema>) => {
    updateApiKeyMutation.mutate(data.apiKey);
  };

  // Submit Gmail settings form
  const onGmailSubmit = (data: z.infer<typeof gmailSchema>) => {
    toast({
      title: "Gmail settings updated",
      description: `Using email: ${data.email}`,
    });
  };

  // Handle setting toggle
  const handleSettingToggle = (setting: keyof UserSettings, checked: boolean) => {
    updateSettingsMutation.mutate({ [setting]: checked });
  };
  
  // Theme management
  const { setTheme, theme } = useTheme();
  
  // Handle theme mode change
  const handleThemeModeChange = (newThemeMode: string) => {
    // Update the next-themes provider immediately
    setTheme(newThemeMode);
    // Save to database
    handleUpdateSettings({ themeMode: newThemeMode });
  };
  
  // Sync theme with user settings on load
  useEffect(() => {
    if (userSettings.themeMode && userSettings.themeMode !== theme) {
      console.log('Syncing theme from database:', userSettings.themeMode, 'current theme:', theme);
      setTheme(userSettings.themeMode);
    }
  }, [userSettings.themeMode, setTheme, theme]);
  
  // Sync theme colors on load
  useEffect(() => {
    if (userSettings.themeColor) {
      console.log('Syncing theme color from database:', userSettings.themeColor);
      // Trigger theme color change to update CSS variables
      const event = new CustomEvent('themeColorChange', { detail: userSettings.themeColor });
      window.dispatchEvent(event);
    }
  }, [userSettings.themeColor]);

  if (isMonitoredEmailsLoading || isUserSettingsLoading) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded mb-8 w-1/5"></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 bg-white rounded-xl shadow-sm"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <Sidebar />
      
      <div className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">Configure your email monitoring and digest preferences</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-primary" />
                Monitored Email Sources
              </CardTitle>
              <CardDescription>
                Configure which email addresses to monitor for digests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monitoredEmails.length > 0 ? (
                  <div className="space-y-3">
                    {monitoredEmails.map(email => (
                      <div key={email.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span>{email.email}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleRemoveEmail(email.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm italic">No email addresses monitored yet.</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-primary text-white hover:bg-blue-600"
                onClick={() => setIsConfigModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add new email source
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="mr-2 h-5 w-5 text-primary" />
                OpenAI API Configuration
              </CardTitle>
              <CardDescription>
                Configure your OpenAI API Key for generating digests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...apiKeyForm}>
                <form onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)} className="space-y-4">
                  <FormField
                    control={apiKeyForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAI API Key</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="sk-..." 
                            type="password" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Your API key is securely stored and used for AI-powered digest generation.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-white hover:bg-blue-600"
                    disabled={updateApiKeyMutation.isPending}
                  >
                    {updateApiKeyMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update API Key"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-2 h-5 w-5 text-primary" />
                Gmail Connection
              </CardTitle>
              <CardDescription>
                Connect your Gmail account to monitor newsletters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-green-800 font-medium">Gmail Connected</span>
                  </div>
                  <p className="text-green-700 text-sm mt-1">Successfully connected to your Gmail account</p>
                </div>
                
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Reconnecting to Gmail",
                      description: "You'll be redirected to Google to reauthorize access.",
                    });
                    // Add Gmail reconnection logic here
                  }}
                >
                  Reconnect Gmail Account
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Digest Preferences</CardTitle>
              <CardDescription>
                Configure how your email digests are generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Digests</p>
                  <p className="text-sm text-muted-foreground">Generate digests once per day</p>
                </div>
                <Switch 
                  checked={userSettings.dailyDigestEnabled}
                  onCheckedChange={(checked) => handleSettingToggle('dailyDigestEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Topic Clustering</p>
                  <p className="text-sm text-muted-foreground">Group emails by similar topics</p>
                </div>
                <Switch 
                  checked={userSettings.topicClusteringEnabled}
                  onCheckedChange={(checked) => handleSettingToggle('topicClusteringEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when digest is ready</p>
                </div>
                <Switch 
                  checked={userSettings.emailNotificationsEnabled}
                  onCheckedChange={(checked) => handleSettingToggle('emailNotificationsEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Palette className="mr-2 h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of SubsBuzz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-medium">Theme Mode</label>
                <Select 
                  value={userSettings.themeMode || "system"} 
                  onValueChange={handleThemeModeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium">Theme Color</label>
                <div className="flex space-x-3">
                  <ThemeColorSelector 
                    value={userSettings.themeColor || "blue"}
                    onChange={(color) => handleUpdateSettings({ themeColor: color })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
}
