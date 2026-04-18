import { motion } from 'framer-motion';
import { Clock, Mail, ArrowRight } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize-html';

export interface HeroArticleData {
  id: string;
  title: string;
  summary: string;
  /** Optional hero image URL. When absent, the hero shows a gradient plate. */
  image?: string | null;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  emailCount: number;
}

interface HeroArticleProps {
  article: HeroArticleData;
  onRead?: () => void;
}

export function HeroArticle({ article, onRead }: HeroArticleProps) {
  return (
    <motion.article
      className="relative overflow-hidden rounded-2xl bg-card border border-border group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid md:grid-cols-2 gap-0">
        <div className="relative h-[400px] md:h-[500px] overflow-hidden">
          {article.image ? (
            <motion.img
              src={article.image}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-accent/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

          <div className="absolute top-6 left-6">
            <span className="px-4 py-2 rounded-full bg-white/95 backdrop-blur-sm text-sm font-medium text-primary">
              {article.topic}
            </span>
          </div>

          <div className="absolute bottom-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-sm">
            <Mail className="size-4 text-accent" />
            <span className="text-sm font-medium text-primary">
              {article.emailCount} sources analysed
            </span>
          </div>
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground font-body">
            <time>
              {new Date(article.date).toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric',
              })}
            </time>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="size-4" />
              <span>{article.readTime}</span>
            </div>
          </div>

          <h3 className="font-display text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {article.title}
          </h3>

          <div
            className="font-body text-lg text-foreground/80 mb-8 leading-relaxed line-clamp-[8] [&>*+*]:mt-3 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.summary) }}
          />

          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="font-body px-3 py-1 rounded-full bg-secondary text-sm text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <motion.button
            type="button"
            onClick={onRead}
            className="font-body inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors self-start"
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            Read Full Digest
            <ArrowRight className="size-5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
