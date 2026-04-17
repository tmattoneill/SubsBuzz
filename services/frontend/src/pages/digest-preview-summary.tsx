import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout';
import { ArticleView } from '@/components/digest/ArticleView';
import { heroArticle } from '@/lib/digest-stubs';

export default function DigestPreviewSummary() {
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="story-theme palette-terracotta min-h-full bg-background">
        <ArticleView
          article={heroArticle}
          onBack={() => setLocation('/digest-preview')}
        />
      </div>
    </DashboardLayout>
  );
}
