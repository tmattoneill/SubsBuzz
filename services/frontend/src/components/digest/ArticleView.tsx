import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Mail, Share2, Bookmark, ChevronRight } from 'lucide-react';

export interface ArticleSource {
  name: string;
  date: string;
  excerpt: string;
}

export interface ArticleViewData {
  id: string;
  title: string;
  summary?: string;
  content: string;
  /** Optional hero image URL. When absent, a gradient plate is shown. */
  image?: string | null;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  emailCount?: number;
  sources?: ArticleSource[];
}

interface ArticleViewProps {
  article: ArticleViewData;
  onBack: () => void;
}

export function ArticleView({ article, onBack }: ArticleViewProps) {
  return (
    <motion.div
      className="min-h-screen bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.button
            type="button"
            onClick={onBack}
            className="font-body flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors"
            whileHover={{ x: -4 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowLeft className="size-5" />
            <span className="font-medium">Back</span>
          </motion.button>

          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              aria-label="Bookmark"
              className="size-10 rounded-full bg-secondary hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Bookmark className="size-5" />
            </motion.button>
            <motion.button
              type="button"
              aria-label="Share"
              className="size-10 rounded-full bg-secondary hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Share2 className="size-5" />
            </motion.button>
          </div>
        </div>
      </div>

      <motion.div
        className="relative h-[60vh] overflow-hidden"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {article.image ? (
          <img
            src={article.image}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-4xl w-full px-6">
          <span className="font-body inline-block px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
            {article.topic}
          </span>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-10">
        <article className="bg-card rounded-2xl border border-border p-8 md:p-12 shadow-2xl">
          <div className="font-body flex items-center gap-4 text-sm text-muted-foreground mb-8">
            <time>
              {new Date(article.date).toLocaleDateString('en-GB', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="size-4" />
              <span>{article.readTime}</span>
            </div>
            {article.emailCount && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Mail className="size-4" />
                  <span>{article.emailCount} sources</span>
                </div>
              </>
            )}
          </div>

          <motion.h1
            className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {article.title}
          </motion.h1>

          {article.summary && (
            <motion.div
              className="font-display text-xl text-foreground/80 mb-8 leading-relaxed [&>*+*]:mt-4 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              dangerouslySetInnerHTML={{ __html: article.summary }}
            />
          )}

          <motion.div
            className="flex flex-wrap gap-2 mb-12 pb-12 border-b border-border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="font-body px-3 py-1 rounded-full bg-secondary text-sm text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </motion.div>

          <motion.div
            className="font-body prose prose-lg max-w-none mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {article.sources && article.sources.length > 0 && (
            <motion.div
              className="mt-16 pt-12 border-t border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <h3 className="font-display text-2xl font-bold mb-6">
                Sources Analysed ({article.sources.length})
              </h3>
              <div className="space-y-4">
                {article.sources.map((source, index) => (
                  <motion.div
                    key={`${source.name}-${index}`}
                    className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.7 + index * 0.1 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="size-4 text-accent" />
                          <span className="font-body font-medium text-foreground">
                            {source.name}
                          </span>
                          <span className="font-body text-sm text-muted-foreground">
                            {new Date(source.date).toLocaleDateString('en-GB', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="font-body text-sm text-foreground/70 line-clamp-2">
                          {source.excerpt}
                        </p>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </article>
      </div>

      <div className="h-24" />
    </motion.div>
  );
}
