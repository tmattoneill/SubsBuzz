import { motion } from 'framer-motion';
import { Clock, ArrowUpRight } from 'lucide-react';

export interface ArticleCardData {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  size?: 'small' | 'medium' | 'large';
}

interface ArticleCardProps {
  article: ArticleCardData;
  onRead?: () => void;
}

export function ArticleCard({ article, onRead }: ArticleCardProps) {
  const heightClass =
    article.size === 'large'
      ? 'h-[500px]'
      : article.size === 'medium'
      ? 'h-[450px]'
      : 'h-[400px]';

  return (
    <motion.article
      onClick={onRead}
      className={`relative overflow-hidden rounded-xl bg-card border border-border group cursor-pointer ${heightClass}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative h-[60%] overflow-hidden">
        <motion.img
          src={article.image}
          alt={article.title}
          className="absolute inset-0 w-full h-full object-cover"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-sm text-xs font-medium text-primary">
            {article.topic}
          </span>
        </div>

        <motion.div
          className="absolute top-4 right-4 size-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100"
          initial={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
        >
          <ArrowUpRight className="size-5 text-primary" />
        </motion.div>
      </div>

      <div className="p-6 h-[40%] flex flex-col">
        <div className="flex items-center gap-2 font-body text-xs text-muted-foreground mb-3">
          <time>
            {new Date(article.date).toLocaleDateString('en-GB', {
              month: 'short',
              day: 'numeric',
            })}
          </time>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="size-3" />
            <span>{article.readTime}</span>
          </div>
        </div>

        <h3 className="font-display text-xl font-bold mb-2 leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {article.title}
        </h3>

        <p className="font-body text-sm text-foreground/70 mb-3 line-clamp-2 flex-1">
          {article.excerpt}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {article.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="font-body px-2 py-0.5 rounded-full bg-secondary text-xs text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 2 && (
            <span className="font-body px-2 py-0.5 rounded-full bg-secondary text-xs text-secondary-foreground">
              +{article.tags.length - 2}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
