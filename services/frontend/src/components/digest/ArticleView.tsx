import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Mail, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { getSenderFaviconUrl, getSenderInitials } from '@/lib/utils';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { RecategoriseMenu } from '@/components/digest/RecategoriseMenu';

export interface ArticleSource {
  name: string;
  date: string;
  excerpt: string;
  senderEmail?: string;
  subject?: string;
  originalLink?: string;
}

export interface ArticleViewData {
  id: string;
  title: string;
  content: string;
  /** Primary hero image URL. Falls back to fallbackImage on load error or bad dimensions. */
  image?: string | null;
  /** Manifest fallback image — used when image is absent, fails, or is banner-shaped. */
  fallbackImage?: string | null;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  emailCount?: number;
  sources?: ArticleSource[];
  /** Link back to the source newsletter. */
  originalLink?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  categoryColor?: string | null;
}

interface ArticleViewProps {
  article: ArticleViewData;
  onBack: () => void;
}

const BANNER_RATIO_THRESHOLD = 3.5;

function splitContentAtFirstHeading(html: string): { deck: string; rest: string } {
  const match = html.match(/<h[23]\b/i);
  if (!match || match.index === undefined || match.index === 0) {
    return { deck: html, rest: '' };
  }
  return { deck: html.slice(0, match.index), rest: html.slice(match.index) };
}

function SourceRow({ source }: { source: ArticleSource }) {
  const [faviconError, setFaviconError] = useState(false);
  const faviconUrl = source.senderEmail ? getSenderFaviconUrl(source.senderEmail) : '';
  const initials = source.senderEmail ? getSenderInitials(source.senderEmail) : source.name.slice(0, 2).toUpperCase();

  return (
    <div className="bg-secondary/50 rounded-xl p-4 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {faviconUrl && !faviconError ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
              {initials}
            </div>
          )}
          <span className="font-body font-medium text-foreground truncate">{source.name}</span>
          <span className="font-body text-xs text-muted-foreground flex-shrink-0">
            {new Date(source.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {source.originalLink && (
          <a
            href={source.originalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-accent transition-colors flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
      {source.subject && (
        <p className="font-body font-medium text-foreground mb-1 break-words">{source.subject}</p>
      )}
      <p className="font-body text-foreground/70 leading-relaxed break-words line-clamp-2">{source.excerpt}</p>
    </div>
  );
}

const SHORT_ARTICLE_WORD_THRESHOLD = 80;

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length;
}

export function ArticleView({ article, onBack }: ArticleViewProps) {
  const { deck, rest } = splitContentAtFirstHeading(article.content);
  const proseClasses =
    'font-display text-lg text-foreground/80 leading-relaxed [&>*+*]:mt-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1';

  const rejectedRef = useRef(new Set<string>());
  const [, setErrorCount] = useState(0);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const bumpError = (url: string) => {
    rejectedRef.current.add(url);
    setErrorCount((n) => n + 1);
  };

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
      if (displaySrc) bumpError(displaySrc);
    }
  };

  const isShort = countWords(article.content) < SHORT_ARTICLE_WORD_THRESHOLD;
  const useFloatLayout = isShort && !!displaySrc;

  return (
    <motion.div
      className="min-h-full bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-3xl mx-auto px-6 pt-6 pb-16">
        <motion.button
          type="button"
          onClick={onBack}
          className="font-body mb-6 inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
          whileHover={{ x: -4 }}
          transition={{ duration: 0.2 }}
        >
          <ArrowLeft className="size-4" />
          <span className="font-medium">Back to digest</span>
        </motion.button>

        <article>
          <div className="mb-3 flex items-center justify-between gap-2">
            {article.categoryName ? (
              <CategoryBadge
                name={article.categoryName}
                slug={article.categorySlug ?? null}
                color={article.categoryColor ?? null}
              />
            ) : (
              <span />
            )}
            <RecategoriseMenu
              digestEmailId={Number(article.id)}
              currentCategorySlug={article.categorySlug}
              variant="inline"
            />
          </div>

          <span className="font-body inline-block text-xs font-semibold uppercase tracking-widest text-accent mb-4">
            {article.topic}
          </span>

          <motion.h1
            className="font-display text-3xl md:text-4xl font-bold mb-4 leading-tight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            {article.title}
          </motion.h1>

          <div className="font-body flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
            <time>
              {new Date(article.date).toLocaleDateString('en-GB', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
            <span className="opacity-60">•</span>
            <div className="flex items-center gap-1">
              <Clock className="size-4" />
              <span>{article.readTime}</span>
            </div>
            {article.emailCount ? (
              <>
                <span className="opacity-60">•</span>
                <div className="flex items-center gap-1">
                  <Mail className="size-4" />
                  <span>{article.emailCount} sources</span>
                </div>
              </>
            ) : null}
          </div>

          {useFloatLayout ? (
            <motion.div
              className="mb-8 overflow-hidden"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <img
                src={displaySrc!}
                alt={article.title}
                className="float-right ml-6 mb-2 w-44 rounded-xl object-cover"
                style={{ aspectRatio: '3/4' }}
                onError={handleError}
                onLoad={handleLoad}
              />
              {deck && (
                <div
                  className={proseClasses}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(deck) }}
                />
              )}
              {rest && (
                <div
                  className={`${proseClasses} mt-3`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(rest) }}
                />
              )}
              <div className="clear-both" />
            </motion.div>
          ) : (
            <>
              {deck && (
                <motion.div
                  className={`${proseClasses} mb-8`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(deck) }}
                />
              )}

              {displaySrc && (
                <motion.img
                  src={displaySrc}
                  alt={article.title}
                  className="w-full rounded-xl mb-8 max-h-[480px] object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  onError={handleError}
                  onLoad={handleLoad}
                />
              )}

              {rest && (
                <motion.div
                  className={`${proseClasses} mb-8`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(rest) }}
                />
              )}
            </>
          )}

          {article.tags.length > 0 && (
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
          )}

          {article.originalLink && (
            <a
              href={article.originalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline mb-8"
            >
              <ExternalLink className="size-4" />
              View original
            </a>
          )}

          {article.sources && article.sources.length > 0 && (
            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-bold flex items-center gap-2">
                  <Mail className="size-5 text-accent" />
                  Source Emails ({article.sources.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setSourcesExpanded((v) => !v)}
                  className="font-body inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {sourcesExpanded ? (
                    <>Hide Sources <ChevronUp className="size-4" /></>
                  ) : (
                    <>Show Sources <ChevronDown className="size-4" /></>
                  )}
                </button>
              </div>
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  sourcesExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-3">
                  {article.sources.map((source, index) => (
                    <SourceRow key={`${source.name}-${index}`} source={source} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </article>
      </div>
    </motion.div>
  );
}
