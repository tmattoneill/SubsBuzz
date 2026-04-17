import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  User,
  TrendingUp,
  Briefcase,
  Zap,
  Globe,
  Cpu,
  Palette,
} from 'lucide-react';
import { HeroArticle, type HeroArticleData } from '@/components/digest/HeroArticle';
import { ArticleCard, type ArticleCardData } from '@/components/digest/ArticleCard';
import { TopicNav, type Topic } from '@/components/digest/TopicNav';

const topics: Topic[] = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'tech', label: 'Tech', icon: Cpu },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'innovation', label: 'Innovation', icon: Zap },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
];

const heroArticle: HeroArticleData = {
  id: '1',
  title: 'The Future of AI-Powered Productivity',
  summary:
    'From autonomous agents to predictive workflows, artificial intelligence is reshaping how teams collaborate and create. We analysed 180 emails from leading tech newsletters to surface the most compelling insights on where productivity tools are headed.',
  image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80',
  topic: 'Tech',
  date: '2026-04-17',
  readTime: '8 min read',
  tags: ['AI', 'Productivity', 'Future of Work'],
  emailCount: 180,
};

const articles: ArticleCardData[] = [
  {
    id: '2',
    title: 'Design Systems at Scale: Lessons from Figma',
    excerpt: 'How the world\'s leading design platforms manage complexity across thousands of components.',
    image: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=800&q=80',
    topic: 'Design',
    date: '2026-04-17',
    readTime: '5 min read',
    tags: ['Design Systems', 'Figma'],
    size: 'large',
  },
  {
    id: '3',
    title: 'The Rise of Climate Tech Startups',
    excerpt: '$50B in funding flowed to climate solutions last year. Here\'s what\'s working.',
    image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80',
    topic: 'Innovation',
    date: '2026-04-16',
    readTime: '6 min read',
    tags: ['Climate', 'Startups', 'VC'],
    size: 'medium',
  },
  {
    id: '4',
    title: 'Remote Work 3.0: Beyond Zoom Fatigue',
    excerpt: 'New async tools are redefining distributed collaboration.',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80',
    topic: 'Business',
    date: '2026-04-16',
    readTime: '4 min read',
    tags: ['Remote Work', 'Productivity'],
    size: 'medium',
  },
  {
    id: '5',
    title: 'Typography Trends Shaping 2026',
    excerpt: 'Variable fonts and kinetic type are transforming digital experiences.',
    image: 'https://images.unsplash.com/photo-1509266272358-7701da638078?w=800&q=80',
    topic: 'Design',
    date: '2026-04-15',
    readTime: '3 min read',
    tags: ['Typography', 'Design Trends'],
    size: 'small',
  },
  {
    id: '6',
    title: 'Edge Computing Explained',
    excerpt: 'Why processing data closer to the source matters more than ever.',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80',
    topic: 'Tech',
    date: '2026-04-15',
    readTime: '7 min read',
    tags: ['Cloud', 'Infrastructure'],
    size: 'small',
  },
  {
    id: '7',
    title: 'The Business Case for Sustainability',
    excerpt: 'ESG isn\'t just good ethics; it\'s becoming a competitive advantage.',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80',
    topic: 'Business',
    date: '2026-04-14',
    readTime: '5 min read',
    tags: ['ESG', 'Strategy'],
    size: 'small',
  },
];

export default function DigestPreview() {
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredArticles = articles.filter((article) => {
    const matchesTopic =
      selectedTopic === 'all' || article.topic.toLowerCase() === selectedTopic;
    const matchesSearch =
      !searchQuery ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTopic && matchesSearch;
  });

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="story-theme palette-terracotta min-h-screen bg-background text-foreground">
      <motion.header
        className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <img
              src="/logo.png"
              alt="SubsBuzz"
              className="h-14 w-auto object-contain"
            />
          </motion.div>

          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search articles, topics, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="font-body w-full pl-12 pr-4 py-3 rounded-full bg-input-background border border-transparent focus:border-accent focus:outline-none transition-all"
              />
            </div>
          </div>

          <motion.button
            type="button"
            aria-label="Account"
            className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <User className="size-5" />
          </motion.button>
        </div>

        <TopicNav
          topics={topics}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
        />
      </motion.header>

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

          <HeroArticle article={heroArticle} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-3xl font-bold">Latest from Your Sources</h2>
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
                <ArticleCard article={article} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
