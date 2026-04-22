import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Key, MapPin, User, Plus, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { UserSettings } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  "Australia",
  "Brazil",
  "Canada",
  "China",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "India",
  "Ireland",
  "Italy",
  "Japan",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Poland",
  "Portugal",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
  "United States",
  "Other",
];

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  openaiApiKey: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function UserProfileModal({ open, onClose }: UserProfileModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    enabled: open,
    select: (data: any) => data?.data ?? data,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      location: "",
      openaiApiKey: "",
    },
  });

  // Populate form once settings load
  useEffect(() => {
    if (settingsData) {
      form.reset({
        firstName: settingsData.firstName ?? "",
        lastName: settingsData.lastName ?? "",
        location: settingsData.location ?? "",
        openaiApiKey: "",
      });
    }
  }, [settingsData, form]);

  const saveProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const profilePayload: Record<string, string> = {
        firstName: values.firstName,
        location: values.location,
      };
      if (values.lastName !== undefined) {
        profilePayload.lastName = values.lastName;
      }
      await api.patch("/api/settings", profilePayload);

      if (values.openaiApiKey) {
        await api.post("/api/settings/api-key", { apiKey: values.openaiApiKey });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Profile saved" });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save profile",
        description: error.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const initials = (() => {
    const first = form.watch("firstName");
    const last = form.watch("lastName");
    if (first || last) {
      return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
    }
    return (user?.email?.[0] ?? "?").toUpperCase();
  })();

  const displayName = (() => {
    const first = form.watch("firstName");
    const last = form.watch("lastName");
    if (first || last) return [first, last].filter(Boolean).join(" ");
    return user?.email ?? "";
  })();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          // Mobile: full screen, no rounding
          "h-screen w-screen rounded-none",
          // Desktop: centered modal
          "sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[580px] sm:rounded-lg",
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg font-semibold">Your Profile</DialogTitle>
        </DialogHeader>

        {isSettingsLoading ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveProfileMutation.mutate(v))}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">
                {/* Avatar + identity strip */}
                <div className="flex items-center gap-4 px-6 py-5 bg-muted/30">
                  <Avatar className="h-14 w-14 text-base">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground leading-tight">
                      {displayName || "Your Name"}
                    </p>
                    <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {/* Personal info */}
                  <section className="px-6 py-5 space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              First name <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="First" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl>
                              <Input placeholder="Last" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            Location <span className="text-destructive">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select your country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COUNTRIES.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </section>

                  {/* Email accounts */}
                  <section className="px-6 py-5 space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      Email Addresses
                    </h3>

                    {/* Primary account */}
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Primary · Gmail</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">Connected</Badge>
                    </div>

                    {/* Additional accounts placeholder */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground"
                      onClick={() =>
                        toast({
                          title: "Coming soon",
                          description: "Additional Gmail and IMAP accounts will be supported in a future update.",
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Connect additional account
                    </Button>
                  </section>

                  {/* API keys */}
                  <section className="px-6 py-5 space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Key className="h-3.5 w-3.5" />
                      API Keys
                    </h3>

                    <FormField
                      control={form.control}
                      name="openaiApiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OpenAI API Key</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={
                                settingsData?.openaiApiKey
                                  ? "Key configured — enter new key to change"
                                  : "sk-..."
                              }
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Used for AI-powered digest generation.{" "}
                            {settingsData?.openaiApiKey && "Leave blank to keep the existing key."}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Future providers */}
                    <div className="space-y-2">
                      {["Anthropic", "DeepSeek", "Custom Ollama"].map((provider) => (
                        <div
                          key={provider}
                          className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2.5 opacity-50"
                        >
                          <span className="text-sm text-muted-foreground">{provider}</span>
                          <Badge variant="outline" className="text-xs">Coming soon</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border flex-shrink-0 bg-background">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => { onClose(); setLocation("/settings"); }}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveProfileMutation.isPending}
                    className="min-w-[80px]"
                  >
                    {saveProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
