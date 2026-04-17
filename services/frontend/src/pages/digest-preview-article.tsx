import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout';
import { ArticleView } from '@/components/digest/ArticleView';
import { findArticle, articleToView } from '@/lib/digest-stubs';

export default function DigestPreviewArticle() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const article = params.id ? findArticle(params.id) : undefined;

  useEffect(() => {
    if (!article) {
      setLocation('/digest-preview');
    }
  }, [article, setLocation]);

  if (!article) return null;

  return (
    <DashboardLayout>
      <div className="story-theme palette-terracotta min-h-full bg-background">
        <ArticleView
          article={articleToView(article)}
          onBack={() => setLocation('/digest-preview')}
        />
      </div>
    </DashboardLayout>
  );
}
