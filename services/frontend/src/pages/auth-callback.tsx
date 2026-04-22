import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { api, tokenManager, clearUserSession } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/AuthContext';

const AuthCallback: React.FC = () => {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code and state from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Send the code to our API Gateway for processing
        const result = await api.post('/api/auth/oauth-callback', {
          code,
          state: state || ''
        });

        if (result.success && result.token) {
          // Wipe any prior user's residue (tokens, onboarding step, pending
          // inbox-cleanup action) BEFORE writing the new session. Covers the
          // same-browser user-swap case where no sign-out happened first.
          clearUserSession();
          // Store access token + long-lived session token (used for silent refresh)
          tokenManager.setTokens(result.token, result.sessionToken || undefined);
          
          toast({
            title: "Authentication Successful",
            description: "Your Gmail account has been connected successfully.",
          });

          // Redirect to latest digest, fall back to dashboard
          try {
            const latest = await api.get('/api/digest/latest');
            const date = latest?.data?.date;
            if (date) {
              window.location.href = `/digest/${date.split('T')[0]}`;
              return;
            }
          } catch {
            // fall through
          }
          window.location.href = '/dashboard';
        } else {
          throw new Error('Authentication failed');
        }

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        toast({
          title: "Authentication Failed",
          description: error.message || "Failed to complete authentication. Please try again.",
          variant: "destructive",
        });

        // Redirect back to login
        setLocation('/login');
      } finally {
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Completing Authentication...
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Please wait while we complete your Gmail connection.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Authentication Complete
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Redirecting you now...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;