/**
 * DeepSeekMigrationModal (TEEPER-139)
 *
 * One-time notice for users who already have an OpenAI API key saved. Explains
 * that DeepSeek v3.2 is now the default and gives them a choice:
 *   - "Switch to DeepSeek" → PATCH { llmProvider: 'deepseek', llmMigrationNoticeSeen: true }
 *   - "Keep using OpenAI" → PATCH { llmMigrationNoticeSeen: true }
 *
 * Renders at the router root via App.tsx. The component self-gates on auth
 * + server-side flags, so it's safe to mount unconditionally in the auth tree.
 *
 * Dismissal is sticky: once `llmMigrationNoticeSeen` flips true, the modal
 * will not reappear on any future login.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { UserSettings, LlmProvider } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DeepSeekMigrationModal() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Suppress the dialog for the rest of this session once the user clicks
  // either button — the server PATCH may take a moment to reflect in the
  // settings query cache, and we don't want it to re-fire.
  const [localDismissed, setLocalDismissed] = useState(false);

  const { data: settings, refetch } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
    refetchOnWindowFocus: false,
    enabled: !!user && !authLoading,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      await apiRequest("PATCH", "/api/settings", patch);
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't update your preference",
        description: error?.message || "Please try again from Settings.",
        variant: "destructive",
      });
    },
  });

  const shouldShow =
    !authLoading &&
    !!user &&
    !localDismissed &&
    settings?.openaiApiKeyConfigured === true &&
    settings?.llmMigrationNoticeSeen === false &&
    settings?.llmProvider === 'openai';

  const handleChoice = (nextProvider: LlmProvider) => {
    setLocalDismissed(true);
    const patch: Partial<UserSettings> = { llmMigrationNoticeSeen: true };
    // Only write llmProvider when it changes — avoid a redundant update when
    // the user is already on OpenAI and chooses to stay.
    if (nextProvider !== settings?.llmProvider) {
      patch.llmProvider = nextProvider;
    }
    mutation.mutate(patch);
  };

  if (!shouldShow) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>We've added a new default</AlertDialogTitle>
          <AlertDialogDescription>
            SubsBuzz now uses DeepSeek v3.2 for digests by default — dramatically
            cheaper with near-matching quality. You have an OpenAI key saved, so
            you're still on OpenAI. Want to switch to DeepSeek? You can change
            this any time in Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => handleChoice("openai")}
            disabled={mutation.isPending}
          >
            Keep using OpenAI
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleChoice("deepseek")}
            disabled={mutation.isPending}
          >
            Switch to DeepSeek
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
