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
import { AddSenderModal } from "@/components/settings/add-sender-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MonitoredEmail, UserSettings, InboxCleanupAction, LlmProvider } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Mail, Key, RefreshCw, Plus, Palette, Trash2 } from "lucide-react";
import { ThemeColorSelector } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";
import { DashboardLayout } from "@/components/layout";

// Display labels for the five inbox-cleanup actions. Kept next to the type so
// any future action gets an obvious home.
const CLEANUP_ACTION_LABELS: Record<InboxCleanupAction, string> = {
  none: "Do Nothing",
  mark_read: "Mark as Read",
  mark_read_archive: "Mark as Read + Archive",
  mark_read_label_archive: "Mark as Read + Apply 'SubsBuzz' Label + Archive",
  trash: "Move to Trash",
};

// The gmail.modify scope grants all five cleanup actions. If the user's stored
// scope includes it, no re-consent is needed.
const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export default function Settings() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isAddSenderOpen, setIsAddSenderOpen] = useState(false);
  // Tracks the action the user has selected but not yet confirmed — used when
  // re-consent is required before persisting a non-'none' action.
  const [pendingCleanupAction, setPendingCleanupAction] =
    useState<InboxCleanupAction | null>(null);
  
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
    themeColor: "blue",
    llmProvider: "deepseek",
  };

  // TEEPER-139: when the toggle is ON, the user pays for their own OpenAI tokens.
  // When OFF, the shared DeepSeek server key is used.
  const useOwnOpenAiKey = userSettings.llmProvider === "openai";

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

  // Test API key
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const handleTestApiKey = async () => {
    setIsTestingApiKey(true);
    try {
      // Only the OpenAI key is user-supplied. The DeepSeek key is server-managed
      // and not testable from the Settings page.
      await apiRequest('GET', '/api/settings/test-api-key?provider=openai');
      toast({ title: "API key is valid", description: "OpenAI is reachable and responding correctly." });
    } catch (error: any) {
      toast({
        title: "API key test failed",
        description: error.message || "Could not reach OpenAI. Check your API key.",
        variant: "destructive",
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  // Toggle between the shared DeepSeek server key and the user's own OpenAI key.
  // Immediate PATCH — there's no Save button for this surface.
  const handleProviderToggle = (checked: boolean) => {
    const nextProvider: LlmProvider = checked ? "openai" : "deepseek";
    updateSettingsMutation.mutate({ llmProvider: nextProvider });
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

  // Whether the user has already consented to the scope needed for cleanup actions.
  const hasGmailModifyScope = (user?.scopes ?? []).includes(GMAIL_MODIFY_SCOPE);

  // Handle inbox cleanup action change. Selecting 'none' persists immediately.
  // Any other value needs gmail.modify — if the user doesn't have it yet,
  // stage the selection and open the re-consent dialog.
  const handleCleanupActionChange = (value: string) => {
    const action = value as InboxCleanupAction;
    if (action === "none" || hasGmailModifyScope) {
      updateSettingsMutation.mutate({ inboxCleanupAction: action });
      return;
    }
    setPendingCleanupAction(action);
  };

  // User confirmed the re-consent dialog — redirect to Google. On return the
  // AuthContext will pick up the new scope via /auth/validate and we'll
  // complete the settings write through the normal PATCH flow on next render.
  // We also stash the pending action in sessionStorage so the post-consent
  // page can finish the write without the user having to re-pick.
  const handleReauthorizeConfirm = async () => {
    if (!pendingCleanupAction) return;
    try {
      sessionStorage.setItem("pendingInboxCleanupAction", pendingCleanupAction);
      const data = (await apiRequest("POST", "/api/auth/reauthorize")) as { auth_url: string };
      window.location.href = data.auth_url;
    } catch (error: any) {
      toast({
        title: "Couldn't start re-authorization",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      setPendingCleanupAction(null);
    }
  };

  // On return from re-consent (scope now granted), finish the pending write.
  useEffect(() => {
    const stashed = sessionStorage.getItem("pendingInboxCleanupAction");
    if (!stashed || !hasGmailModifyScope) return;
    sessionStorage.removeItem("pendingInboxCleanupAction");
    updateSettingsMutation.mutate({ inboxCleanupAction: stashed as InboxCleanupAction });
  }, [hasGmailModifyScope]);
  
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
      <DashboardLayout>
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 rounded bg-muted" />
            <div className="h-4 w-1/5 rounded bg-muted" />
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-64 rounded-xl border border-dashed border-border" />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your monitoring sources, automation, and appearance.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
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
                onClick={() => setIsAddSenderOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add new email source
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="mr-2 h-5 w-5 text-primary" />
                AI Provider
              </CardTitle>
              <CardDescription>
                Choose which AI service generates your digests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* TEEPER-139: DeepSeek (default) vs. user-supplied OpenAI key */}
              <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="font-medium">Use my own OpenAI API key</p>
                  <p className="text-sm text-muted-foreground">
                    {useOwnOpenAiKey
                      ? "Your OpenAI key below is used for every digest. You pay OpenAI's token costs."
                      : "SubsBuzz's built-in DeepSeek v3.2 is used. No key needed. Free."}
                  </p>
                </div>
                <Switch
                  checked={useOwnOpenAiKey}
                  onCheckedChange={handleProviderToggle}
                  disabled={updateSettingsMutation.isPending}
                  aria-label="Use my own OpenAI API key"
                />
              </div>

              <Form {...apiKeyForm}>
                <form
                  onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)}
                  className={`space-y-4 ${useOwnOpenAiKey ? "" : "opacity-50"}`}
                >
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
                            disabled={!useOwnOpenAiKey}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {userSettings.openaiApiKeyConfigured
                            ? "A key is saved. Paste a new one to replace it."
                            : "Your key is stored securely and only used when the toggle above is on."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleTestApiKey}
                      disabled={!useOwnOpenAiKey || isTestingApiKey || updateApiKeyMutation.isPending}
                    >
                      {isTestingApiKey ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test"
                      )}
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-primary text-white hover:bg-blue-600"
                      disabled={!useOwnOpenAiKey || updateApiKeyMutation.isPending || isTestingApiKey}
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
                  </div>
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
              <CardTitle className="flex items-center">
                <Trash2 className="mr-2 h-5 w-5 text-primary" />
                Inbox Cleanup
              </CardTitle>
              <CardDescription>
                Choose what happens to newsletters in Gmail after we've summarised them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                value={userSettings.inboxCleanupAction || "none"}
                onValueChange={handleCleanupActionChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLEANUP_ACTION_LABELS) as InboxCleanupAction[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {CLEANUP_ACTION_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(userSettings.inboxCleanupAction && userSettings.inboxCleanupAction !== "none") ? (
                <p className="text-xs text-muted-foreground">
                  Sources stay viewable in your SubsBuzz history after cleanup. "Move to Trash"
                  is recoverable in Gmail for 30 days.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Default: digested emails stay untouched in your inbox.
                </p>
              )}
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

        <AddSenderModal open={isAddSenderOpen} onOpenChange={setIsAddSenderOpen} />

        {/* Re-consent gate: shown when the user picks a cleanup action that
            requires the gmail.modify scope they haven't granted yet. */}
        <Dialog
          open={pendingCleanupAction !== null}
          onOpenChange={(open) => {
            if (!open) setPendingCleanupAction(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>One-time permission needed</DialogTitle>
              <DialogDescription>
                To clean up your inbox after digesting messages, SubsBuzz needs permission
                to modify your Gmail labels and trash. Your emails stay private — we only
                act on messages we've already digested for you. You can change this anytime
                in{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Gmail's Connected Apps
                </a>
                .
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPendingCleanupAction(null)}>
                Cancel
              </Button>
              <Button onClick={handleReauthorizeConfirm}>
                Continue to Google →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
