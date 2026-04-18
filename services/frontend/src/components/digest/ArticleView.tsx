import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Mail, ChevronRight, ExternalLink } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize-html';

export interface ArticleSource {
  name: string;
  date: string;
  excerpt: string;
}

export interface ArticleViewData {
  id: string;
  title: string;
  content: string;
  /** Optional hero image URL. Rendered inline below the header when present. */
  image?: string | null;
  topic: string;
  date: string;
  readTime: string;
  tags: string[];
  emailCount?: number;
  sources?: ArticleSource[];
  /** Link back to the source newsletter. Rendered as "View original" below the body. */
  originalLink?: string | null;
}

interface ArticleViewProps {
  article: ArticleViewData;
  onBack: () => void;
}

// Split the body HTML at the first heading (h2/h3) so we can render the
// lead/deck before the hero image and the sectioned body after it.
function splitContentAtFirstHeading(html: string): { deck: string; rest: string } {
  const match = html.match(/<h[23]\b/i);
  if (!match || match.index === undefined || match.index === 0) {
    return { deck: html, rest: '' };
  }
  return { deck: html.slice(0, match.index), rest: html.slice(match.index) };
}

export function ArticleView({ article, onBack }: ArticleViewProps) {
  const { deck, rest } = splitContentAtFirstHeading(article.content);
  const proseClasses =
    'font-display text-lg text-foreground/80 leading-relaxed [&>*+*]:mt-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1';

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

          {deck && (
            <motion.div
              className={`${proseClasses} mb-8`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(deck) }}
            />
          )}

          {article.image && (
            <motion.img
              src={article.image}
              alt={article.title}
              className="w-full rounded-xl mb-8 max-h-[480px] object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
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
              <h3 className="font-display text-xl font-bold mb-4">
                Sources Analysed ({article.sources.length})
              </h3>
              <div className="space-y-3">
                {article.sources.map((source, index) => (
                  <div
                    key={`${source.name}-${index}`}
                    className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </motion.div>
  );
}
