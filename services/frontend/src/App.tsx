import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/lib/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import EmailHandling from "@/pages/email-handling";
import CategoryCollection from "@/pages/category-collection";
import DigestView from "@/pages/digest";
import DigestLatestRedirect from "@/pages/digest-latest-redirect";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Landing from "@/pages/landing";
import AuthCallback from "@/pages/auth-callback";
import { DeepSeekMigrationModal } from "@/components/settings/DeepSeekMigrationModal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={History} />
      <Route path="/digest" component={DigestLatestRedirect} />
      <Route path="/digest/:date" component={DigestView} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/email-handling" component={EmailHandling} />
      <Route path="/email-handling/:tab" component={EmailHandling} />
      <Route path="/category/:slug" component={CategoryCollection} />
      <Route path="/login" component={Login} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem={true}
          storageKey="theme-mode"
          disableTransitionOnChange={true}
        >
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <DeepSeekMigrationModal />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
