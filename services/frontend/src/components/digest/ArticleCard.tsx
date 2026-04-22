import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowUpRight } from 'lucide-react';
import { CategoryBadge } from '@/components/categories/CategoryBadge';

export interface ArticleCardData {
  id: string;
  title: string;
  excerpt: string;
  /** Primary hero image URL (the article's own image). Falls back to fallbackImage on load error or bad dimensions. */
  image?: string | null;
  /** Manifest fallback image — used when `image` is absent, fails to load, or is banner-shaped. */
  fallbackImage?: string | null;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  size?: 'small' | 'medium' | 'large';
  categoryName?: string | null;
  categorySlug?: string | null;
  categoryColor?: string | null;
}

interface ArticleCardProps {
  article: ArticleCardData;
  onRead?: () => void;
}

// Max width:height ratio before we treat an image as a newsletter banner.
const BANNER_RATIO_THRESHOLD = 3.5;

export function ArticleCard({ article, onRead }: ArticleCardProps) {
  const heightClass =
    article.size === 'large'
      ? 'h-[500px]'
      : article.size === 'medium'
      ? 'h-[450px]'
      : 'h-[400px]';

  // Track rejected URLs so we step down: primary → fallback → gradient.
  // Stored in a ref so mutations don't cause renders; errorCount triggers them.
  const rejectedRef = useRef(new Set<string>());
  const [, setErrorCount] = useState(0);

  const bumpError = (url: string) => {
    rejectedRef.current.add(url);
    setErrorCount((n) => n + 1);
  };

  // Derive display URL from props on every render — so when fallbackImage
  // arrives (manifest loaded after mount) we naturally pick it up.
  const candidates = [article.image, article.fallbackImage].filter(
    (u): u is string => Boolean(u) && !rejectedRef.current.has(u),
  );
  const displaySrc = candidates[0] ?? null;

  const handleError = () => {
    if (displaySrc) bumpError(displaySrc);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (
      img.naturalWidth > 0 &&
      img.naturalHeight > 0 &&
      img.naturalWidth / img.naturalHeight > BANNER_RATIO_THRESHOLD
    ) {
      // Too wide to be a hero — treat as rejected and step down to fallback.
      if (displaySrc) bumpError(displaySrc);
    }
  };

  return (
    <motion.article
      onClick={onRead}
      className={`relative overflow-hidden rounded-xl bg-card border border-border group cursor-pointer flex flex-col hover:ring-2 hover:ring-primary/30 transition-shadow ${heightClass}`}
    >
      <div className="relative flex-shrink-0 h-[60%] overflow-hidden">
        {displaySrc ? (
          <motion.img
            src={displaySrc}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
            whileHover={{ scale: 1.08 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onError={handleError}
            onLoad={handleLoad}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-accent/20" />
        )}
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

      <div className="p-6 flex-1 flex flex-col overflow-hidden">
        {article.categoryName ? (
          <div className="mb-2">
            <CategoryBadge
              name={article.categoryName}
              slug={article.categorySlug ?? null}
              color={article.categoryColor ?? null}
              linkable={false}
            />
          </div>
        ) : null}

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

        <h3 className="font-display text-lg font-bold mb-2 leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {article.title}
        </h3>

        <p className="font-body text-sm text-foreground/70 mb-3 line-clamp-2 flex-1 min-h-0">
          {article.excerpt}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-auto">
          {article.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="font-body px-2 py-0.5 rounded-full bg-secondary text-xs text-[#191919]"
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 2 && (
            <span className="font-body px-2 py-0.5 rounded-full bg-secondary text-xs text-[#191919]">
              +{article.tags.length - 2}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
