import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { TosContent } from '@/components/legal/TosContent';

export default function TermsOfService() {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/login">
            <img src="/logo-banner-bk.png" alt="SubsBuzz" className="h-8 w-auto object-contain dark:hidden" />
            <img src="/logo-banner-wt.png" alt="SubsBuzz" className="h-8 w-auto object-contain hidden dark:block" />
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
          <TosContent />

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-3">
            <Button onClick={handleBack} className="w-full sm:w-auto">
              &larr; Back
            </Button>
            <Link href="/privacy" className="text-sm text-primary hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
