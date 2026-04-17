import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout';
import { HeroArticle } from '@/components/digest/HeroArticle';
import { ArticleCard } from '@/components/digest/ArticleCard';
import { TopicNav } from '@/components/digest/TopicNav';
import { heroArticle, articles, topics } from '@/lib/digest-stubs';

export default function DigestPreview() {
  const [, setLocation] = useLocation();
  const [selectedTopic, setSelectedTopic] = useState('all');

  const filteredArticles = articles.filter(
    (article) =>
      selectedTopic === 'all' || article.topic.toLowerCase() === selectedTopic,
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <DashboardLayout>
      <div className="story-theme palette-terracotta min-h-full bg-background">
        <TopicNav
          topics={topics}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
        />

        <main className="max-w-[1600px] mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <TrendingUp className="size-4 text-accent" />
                <span className="font-body text-sm font-medium text-accent">
                  Today&rsquo;s Meta Summary
                </span>
              </motion.div>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-2">
                Your Daily Intelligence Brief
              </h2>
              <p className="font-body text-muted-foreground text-lg">{today}</p>
            </div>

            <div onClick={() => setLocation('/digest-preview/summary')}>
              <HeroArticle
                article={heroArticle}
                onRead={() => setLocation('/digest-preview/summary')}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl font-bold">
                Latest from Your Sources
              </h2>
              <p className="font-body text-muted-foreground">
                {filteredArticles.length}{' '}
                {filteredArticles.length === 1 ? 'article' : 'articles'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.7 + index * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={article.size === 'large' ? 'md:col-span-2' : 'md:col-span-1'}
                >
                  <ArticleCard
                    article={article}
                    onRead={() =>
                      setLocation(`/digest-preview/article/${article.id}`)
                    }
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    </DashboardLayout>
  );
}
