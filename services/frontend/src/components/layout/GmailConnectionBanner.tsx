import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

// Surfaces oauth_tokens.revoked_at to the user. Set by the email worker when
// Google returns invalid_grant on the refresh token (typically Google's 7-day
// Testing-mode revocation). Cleared automatically by the OAuth callback when
// the user re-consents. (TEEPER-204)
export function GmailConnectionBanner() {
  const { user, reauthorize } = useAuth();

  if (user?.connectionStatus !== "revoked") return null;

  return (
    <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>
            <span className="font-medium">We've lost access to your Gmail.</span>{" "}
            Reconnect to resume your daily digest.
          </span>
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            void reauthorize();
          }}
        >
          Reconnect Gmail
        </Button>
      </div>
    </div>
  );
}
