import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, TrendingUp, Clock, Zap, Shield, Star } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Landing() {
  const { user, isLoading, signIn } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user && !isLoading) {
      setLocation('/dashboard');
    }
  }, [user, isLoading, setLocation]);

  const handleGetStarted = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const features = [
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Smart Analysis",
      description: "AI-powered thematic analysis groups related emails into meaningful topics"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Daily Digests",
      description: "Get your personalized summary delivered at your preferred time"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Instant Setup",
      description: "We'll scan your Gmail and suggest newsletters to get you started"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Privacy First",
      description: "Read-only Gmail access with secure OAuth authentication"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-gray-900">SubsBuzz</span>
        </div>
        <Button variant="outline" onClick={handleGetStarted} disabled={isLoading}>
          Sign In
        </Button>
      </header>

      {/* Hero Section */}
      <section className="px-4 py-20 text-center max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Transform Your Email 
            <span className="text-primary"> Subscriptions</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Analyze and synthesize all your newsletters and email subscriptions in one place. 
            Get intelligent daily digests that surface the most important insights from your inbox.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-4 bg-primary hover:bg-blue-600"
            onClick={handleGetStarted}
            disabled={isLoading}
          >
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
            Get Started with Google
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {features.map((feature, index) => (
            <Card key={index} className="text-center border-0 shadow-sm bg-white/60 backdrop-blur-sm">
              <CardHeader>
                <div className="mx-auto mb-2 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="px-4 py-16 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How SubsBuzz Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto">
                1
              </div>
              <h3 className="text-xl font-semibold">Connect Your Gmail</h3>
              <p className="text-gray-600">
                Securely connect your Gmail account. We'll scan for newsletters and subscriptions automatically.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto">
                2
              </div>
              <h3 className="text-xl font-semibold">Choose Your Sources</h3>
              <p className="text-gray-600">
                Select which newsletters and subscriptions you want included in your daily digest.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mx-auto">
                3
              </div>
              <h3 className="text-xl font-semibold">Get Smart Summaries</h3>
              <p className="text-gray-600">
                Receive intelligent thematic summaries that highlight the most important insights from your inbox.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <blockquote className="text-xl text-gray-700 mb-4">
            "SubsBuzz transformed how I consume my newsletter subscriptions. Instead of drowning in emails, 
            I get perfectly curated daily summaries that actually help me stay informed."
          </blockquote>
          <cite className="text-gray-500">— Early Beta User</cite>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 bg-primary text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Email Experience?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of users who've already simplified their newsletter management with SubsBuzz.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-4"
            onClick={handleGetStarted}
            disabled={isLoading}
          >
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
            Start Your Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 bg-gray-900 text-white text-center">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Mail className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">SubsBuzz</span>
        </div>
        <p className="text-gray-400">
          Transform your email subscriptions into actionable insights
        </p>
      </footer>
    </div>
  );
}