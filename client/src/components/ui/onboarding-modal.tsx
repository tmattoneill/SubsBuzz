import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { NewsletterSender } from '@/lib/types';
import { Mail, Search, Clock, Settings, CheckCircle, Plus, Loader2 } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

enum OnboardingStep {
  GMAIL_AUTH = 'gmail_auth',
  SCANNING = 'scanning',
  NEWSLETTER_SELECTION = 'newsletter_selection',
  CUSTOM_EMAILS = 'custom_emails',
  FREQUENCY = 'frequency',
  CONFIRMATION = 'confirmation'
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.GMAIL_AUTH);
  const [selectedNewsletters, setSelectedNewsletters] = useState<Set<string>>(new Set());
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [digestFrequency, setDigestFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number>(3);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle Gmail authorization
  const handleGmailAuth = async () => {
    try {
      const response = await fetch('/api/auth/gmail-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'onboarding-gmail-auth' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Gmail auth URL');
      }
      
      const { authUrl } = await response.json();
      
      // Store current step in localStorage so we can resume after OAuth
      localStorage.setItem('onboarding_step', 'scanning');
      
      // Redirect to Google OAuth for Gmail access
      window.location.href = authUrl;
    } catch (error) {
      console.error('Gmail auth error:', error);
      toast({
        title: "Error",
        description: "Failed to start Gmail authorization. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Check if we're returning from Gmail OAuth or if user already has Gmail access
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storedStep = localStorage.getItem('onboarding_step');
    
    if (urlParams.get('connected') === 'gmail' && storedStep === 'scanning') {
      // Clear the parameter and stored step
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.removeItem('onboarding_step');
      setCurrentStep(OnboardingStep.SCANNING);
    } else if (isOpen && currentStep === OnboardingStep.GMAIL_AUTH) {
      // Check if user already has Gmail access by trying to scan
      fetch('/api/onboarding/scan-newsletters')
        .then(res => {
          if (res.ok) {
            // User already has Gmail access, skip to scanning
            setCurrentStep(OnboardingStep.SCANNING);
          }
        })
        .catch(() => {
          // User needs Gmail auth, stay on current step
        });
    }
  }, [isOpen, currentStep]);

  // Scan for newsletters
  const { 
    data: scanData, 
    isLoading: isScanning, 
    isError: scanError,
    refetch: rescanNewsletters 
  } = useQuery({
    queryKey: ['/api/onboarding/scan-newsletters'],
    enabled: isOpen && currentStep === OnboardingStep.SCANNING,
    refetchOnWindowFocus: false,
  });

  // Save onboarding selections
  const saveSelectionsMutation = useMutation({
    mutationFn: async (data: { 
      emails: string[], 
      frequency: string,
      customDays?: number 
    }) => {
      return await fetch('/api/onboarding/save-selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());
    },
    onSuccess: () => {
      setCurrentStep(OnboardingStep.CONFIRMATION);
      toast({
        title: "Setup Complete!",
        description: "Your first digest is being generated in the background."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save your selections. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Auto-advance from scanning when complete
  useEffect(() => {
    if (scanData && !isScanning && currentStep === OnboardingStep.SCANNING) {
      setCurrentStep(OnboardingStep.NEWSLETTER_SELECTION);
    }
  }, [scanData, isScanning, currentStep]);

  const newsletters: NewsletterSender[] = (scanData as any)?.newsletters || [];

  const handleNewsletterToggle = (email: string) => {
    const newSelected = new Set(selectedNewsletters);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedNewsletters(newSelected);
  };

  const handleAddCustomEmail = () => {
    if (newEmail && !customEmails.includes(newEmail)) {
      setCustomEmails([...customEmails, newEmail]);
      setNewEmail('');
    }
  };

  const handleRemoveCustomEmail = (email: string) => {
    setCustomEmails(customEmails.filter(e => e !== email));
  };

  const handleFinishOnboarding = async () => {
    setIsProcessing(true);
    
    const allEmails = [
      ...Array.from(selectedNewsletters),
      ...customEmails
    ];

    if (allEmails.length === 0) {
      toast({
        title: "No Newsletters Selected",
        description: "Please select at least one newsletter to monitor.",
        variant: "destructive"
      });
      setIsProcessing(false);
      return;
    }

    const frequencyData = {
      emails: allEmails,
      frequency: digestFrequency,
      ...(digestFrequency === 'custom' && { customDays })
    };

    await saveSelectionsMutation.mutateAsync(frequencyData);
    setIsProcessing(false);
  };

  const getStepProgress = () => {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const StepIndicator = ({ step, isActive, isCompleted, title }: {
    step: number;
    isActive: boolean;
    isCompleted: boolean;
    title: string;
  }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        isCompleted ? 'bg-green-500 text-white' :
        isActive ? 'bg-primary text-white' :
        'bg-gray-200 text-gray-500'
      }`}>
        {isCompleted ? <CheckCircle className="w-4 h-4" /> : step}
      </div>
      <span className={`text-sm ${isActive ? 'font-medium' : 'text-gray-500'}`}>
        {title}
      </span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5" />
            <span>Welcome to SubsBuzz</span>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-4">
          <Progress value={getStepProgress()} className="w-full" />
          
          {/* Step Indicators */}
          <div className="flex justify-between text-xs">
            <StepIndicator
              step={1}
              isActive={currentStep === OnboardingStep.GMAIL_AUTH}
              isCompleted={[OnboardingStep.SCANNING, OnboardingStep.NEWSLETTER_SELECTION, OnboardingStep.CUSTOM_EMAILS, OnboardingStep.FREQUENCY, OnboardingStep.CONFIRMATION].includes(currentStep)}
              title="Connect"
            />
            <StepIndicator
              step={2}
              isActive={currentStep === OnboardingStep.SCANNING}
              isCompleted={[OnboardingStep.NEWSLETTER_SELECTION, OnboardingStep.CUSTOM_EMAILS, OnboardingStep.FREQUENCY, OnboardingStep.CONFIRMATION].includes(currentStep)}
              title="Scan"
            />
            <StepIndicator
              step={3}
              isActive={currentStep === OnboardingStep.NEWSLETTER_SELECTION}
              isCompleted={[OnboardingStep.CUSTOM_EMAILS, OnboardingStep.FREQUENCY, OnboardingStep.CONFIRMATION].includes(currentStep)}
              title="Select"
            />
            <StepIndicator
              step={4}
              isActive={currentStep === OnboardingStep.CUSTOM_EMAILS}
              isCompleted={[OnboardingStep.FREQUENCY, OnboardingStep.CONFIRMATION].includes(currentStep)}
              title="Customize"
            />
            <StepIndicator
              step={5}
              isActive={currentStep === OnboardingStep.FREQUENCY}
              isCompleted={currentStep === OnboardingStep.CONFIRMATION}
              title="Schedule"
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === OnboardingStep.GMAIL_AUTH && (
            <div className="text-center space-y-6 py-8">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Connect Your Gmail</h3>
                  <p className="text-gray-600 mb-4">
                    To scan for newsletters and create your digest, we need access to your Gmail account.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg text-sm text-left max-w-md mx-auto">
                    <h4 className="font-medium mb-2">What we'll do:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Scan your recent emails for newsletters</li>
                      <li>• Read only emails from senders you approve</li>
                      <li>• Never send emails or access your contacts</li>
                      <li>• Create intelligent summaries of your content</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button size="lg" onClick={handleGmailAuth} className="bg-primary hover:bg-blue-600">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  width="24" 
                  height="24" 
                  className="w-5 h-5 mr-2"
                >
                  <path 
                    fill="#EA4335" 
                    d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z" 
                  />
                  <path 
                    fill="#34A853" 
                    d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z" 
                  />
                  <path 
                    fill="#4A90E2" 
                    d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z" 
                  />
                  <path 
                    fill="#FBBC05" 
                    d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z" 
                  />
                </svg>
                Connect Gmail Account
              </Button>

              <p className="text-xs text-gray-500">
                You'll be redirected to Google to grant permissions
              </p>
            </div>
          )}

          {currentStep === OnboardingStep.SCANNING && (
            <div className="text-center space-y-6 py-8">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  {isScanning ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : scanError ? (
                    <Search className="w-8 h-8 text-red-500" />
                  ) : (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {isScanning ? 'Scanning Your Gmail' : 
                     scanError ? 'Scan Failed' : 
                     'Scan Complete'}
                  </h3>
                  <p className="text-gray-600">
                    {isScanning ? 'We\'re looking through your recent emails to find newsletters and subscriptions...' :
                     scanError ? 'We couldn\'t scan your Gmail. You can still add newsletters manually.' :
                     `Found ${newsletters.length} potential newsletters in your inbox.`}
                  </p>
                </div>
              </div>
              
              {scanError && (
                <div className="space-y-4">
                  <Button onClick={() => rescanNewsletters()} variant="outline">
                    Try Again
                  </Button>
                  <p className="text-sm text-gray-500">
                    Or click "Continue" to add newsletters manually.
                  </p>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setCurrentStep(OnboardingStep.GMAIL_AUTH)}>
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(OnboardingStep.NEWSLETTER_SELECTION)}>
                      Continue Without Scanning
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === OnboardingStep.NEWSLETTER_SELECTION && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Select Your Newsletters</h3>
                <p className="text-gray-600">
                  Choose which newsletters you'd like to include in your daily digest.
                </p>
              </div>

              {newsletters.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {selectedNewsletters.size} of {newsletters.length} selected
                    </span>
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedNewsletters(new Set())}
                      >
                        Clear All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedNewsletters(new Set(newsletters.map(n => n.email)))}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 max-h-64 overflow-y-auto">
                    {newsletters.map((newsletter) => (
                      <Card key={newsletter.email} className="cursor-pointer hover:bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={selectedNewsletters.has(newsletter.email)}
                              onCheckedChange={() => handleNewsletterToggle(newsletter.email)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium truncate">{newsletter.name}</h4>
                                <Badge variant="secondary" className="ml-2">
                                  {newsletter.count} emails
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500 truncate">
                                {newsletter.email}
                              </p>
                              <p className="text-xs text-gray-400 truncate mt-1">
                                Latest: {newsletter.latestSubject}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    No newsletters found in your recent emails.
                  </p>
                  <p className="text-sm text-gray-400">
                    Don't worry! You can add them manually on the next step.
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(OnboardingStep.SCANNING)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(OnboardingStep.CUSTOM_EMAILS)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {currentStep === OnboardingStep.CUSTOM_EMAILS && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Add Custom Newsletters</h3>
                <p className="text-gray-600">
                  Add any specific newsletter email addresses we might have missed.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="newsletter@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustomEmail()}
                  />
                  <Button onClick={handleAddCustomEmail}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {customEmails.length > 0 && (
                  <div className="space-y-2">
                    <Label>Custom Newsletters:</Label>
                    <div className="space-y-2">
                      {customEmails.map((email) => (
                        <div key={email} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{email}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCustomEmail(email)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-gray-600">
                    You've selected <strong>{selectedNewsletters.size + customEmails.length}</strong> newsletters to monitor.
                  </p>
                  {selectedNewsletters.size > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Discovered: {Array.from(selectedNewsletters).join(', ')}
                    </p>
                  )}
                  {customEmails.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Custom: {customEmails.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(OnboardingStep.NEWSLETTER_SELECTION)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(OnboardingStep.FREQUENCY)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {currentStep === OnboardingStep.FREQUENCY && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Digest Frequency</h3>
                <p className="text-gray-600">
                  How often would you like to receive your newsletter digest?
                </p>
              </div>

              <div className="space-y-4">
                <Card className={`cursor-pointer transition-colors ${digestFrequency === 'daily' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4" onClick={() => setDigestFrequency('daily')}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={digestFrequency === 'daily'}
                        onChange={() => setDigestFrequency('daily')}
                        className="w-4 h-4"
                      />
                      <div>
                        <h4 className="font-medium">Daily</h4>
                        <p className="text-sm text-gray-500">
                          Get your digest every morning at 7 AM
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-colors ${digestFrequency === 'weekly' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4" onClick={() => setDigestFrequency('weekly')}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={digestFrequency === 'weekly'}
                        onChange={() => setDigestFrequency('weekly')}
                        className="w-4 h-4"
                      />
                      <div>
                        <h4 className="font-medium">Weekly</h4>
                        <p className="text-sm text-gray-500">
                          Get your digest every Monday morning
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-colors ${digestFrequency === 'custom' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4" onClick={() => setDigestFrequency('custom')}>
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={digestFrequency === 'custom'}
                        onChange={() => setDigestFrequency('custom')}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">Custom</h4>
                        <p className="text-sm text-gray-500 mb-2">
                          Choose your own frequency
                        </p>
                        {digestFrequency === 'custom' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">Every</span>
                            <Select value={customDays.toString()} onValueChange={(value) => setCustomDays(parseInt(value))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 5, 6, 7, 10, 14].map(days => (
                                  <SelectItem key={days} value={days.toString()}>
                                    {days}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm">days</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(OnboardingStep.CUSTOM_EMAILS)}>
                  Back
                </Button>
                <Button onClick={handleFinishOnboarding} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting Up...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </Button>
              </div>
            </div>
          )}

          {currentStep === OnboardingStep.CONFIRMATION && (
            <div className="text-center space-y-6 py-8">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Welcome to SubsBuzz!</h3>
                  <p className="text-gray-600 mb-4">
                    Your account is set up and your first digest is being generated.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg text-sm">
                    <p>
                      <strong>Monitoring:</strong> {selectedNewsletters.size + customEmails.length} newsletters
                    </p>
                    <p>
                      <strong>Frequency:</strong> {digestFrequency === 'custom' ? `Every ${customDays} days` : digestFrequency}
                    </p>
                  </div>
                </div>
              </div>

              <Button size="lg" onClick={onComplete}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}