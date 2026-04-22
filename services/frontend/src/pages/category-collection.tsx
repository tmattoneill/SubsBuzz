import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api-client";
import { DashboardLayout } from "@/components/layout";
import { ArticleCard, type ArticleCardData } from "@/components/digest/ArticleCard";
import {
  ArticleView,
  type ArticleViewData,
} from "@/components/digest/ArticleView";
import { useCategories } from "@/hooks/useCategories";
import type { DigestEmail } from "@/lib/types";
import {
  warmHeroManifest,
  getArticleHeroFallbackSync,
  isGoodHeroUrl,
  type HeroManifest,
} from "@/lib/article-heroes";

function computeReadTime(content: string | undefined | null): string {
  const len = (content ?? "").length;
  const minutes = Math.max(1, Math.round(len / 1000));
  return `${minutes} min read`;
}

function topicFor(email: DigestEmail): string {
  return email.source?.trim() || email.sender.split("@")[0] || "Newsletter";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCard(email: DigestEmail, color: string | null, manifest: HeroManifest | null): ArticleCardData {
  return {
    id: String(email.id),
    title: email.subject,
    excerpt: email.snippet || email.summary,
    image: isGoodHeroUrl(email.heroImageUrl) ? email.heroImageUrl : null,
    fallbackImage: getArticleHeroFallbackSync(manifest, email.categorySlugSnapshot, "3_4"),
    topic: topicFor(email),
    date: email.receivedAt,
    readTime: computeReadTime(email.summaryHtml ?? email.summary),
    tags: email.topics?.slice(0, 4) ?? [],
    categoryName: email.categoryNameSnapshot ?? null,
    categorySlug: email.categorySlugSnapshot ?? null,
    categoryColor: color,
  };
}

function toView(email: DigestEmail, color: string | null, manifest: HeroManifest | null): ArticleViewData {
  const body = email.summaryHtml
    ? email.summaryHtml
    : `<p>${escapeHtml(email.summary)}</p>`;
  return {
    id: String(email.id),
    title: email.subject,
    content: body,
    image: isGoodHeroUrl(email.heroImageUrl) ? email.heroImageUrl : null,
    fallbackImage: getArticleHeroFallbackSync(manifest, email.categorySlugSnapshot, "16_9"),
    topic: topicFor(email),
    date: email.receivedAt,
    readTime: computeReadTime(email.summaryHtml ?? email.summary),
    tags: email.topics ?? [],
    originalLink: email.originalLink ?? null,
    categoryName: email.categoryNameSnapshot ?? null,
    categorySlug: email.categorySlugSnapshot ?? null,
    categoryColor: color,
  };
}

export default function CategoryCollection() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/category/:slug");
  const slug = params?.slug;
  const [openArticle, setOpenArticle] = useState<ArticleViewData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    setOpenArticle(null);
  }, [slug]);

  const { data: categories = [] } = useCategories();
  const liveCategory = useMemo(
    () => categories.find((c) => c.slug === slug) ?? null,
    [categories, slug],
  );

  const { data: emails = [], isLoading, isError } = useQuery<DigestEmail[]>({
    queryKey: ["/api/digest/by-category", slug],
    queryFn: () => api.get<DigestEmail[]>(`/api/digest/by-category/${slug}?limit=100`),
    enabled: !!slug,
  });

  const { data: heroManifest = null } = useQuery<HeroManifest | null>({
    queryKey: ["article-hero-manifest"],
    queryFn: warmHeroManifest,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const color = liveCategory?.color ?? null;
  const displayName =
    liveCategory?.name ??
    emails.find((e) => e.categoryNameSnapshot)?.categoryNameSnapshot ??
    slug ??
    "Category";

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (openArticle) {
    return (
      <DashboardLayout>
        <div className="story-theme palette-terracotta min-h-full bg-background">
          <ArticleView article={openArticle} onBack={() => setOpenArticle(null)} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="story-theme palette-terracotta min-h-full bg-background">
        <main className="max-w-[1600px] mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {color ? (
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ) : null}
                Collection
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mt-2 mb-2">
                {displayName}
              </h2>
              <p className="font-body text-muted-foreground text-lg">
                {isLoading
                  ? "Loading…"
                  : `${emails.length} ${emails.length === 1 ? "article" : "articles"} across your history`}
              </p>
            </div>
          </motion.div>

          {isError ? (
            <div className="rounded-xl bg-card border border-border p-12 text-center">
              <p className="font-body text-muted-foreground">
                Could not load this collection.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-12 text-center">
              <p className="font-body text-muted-foreground">
                No articles in this collection yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {emails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.03 * index }}
                >
                  <ArticleCard
                    article={toCard(email, color, heroManifest)}
                    onRead={() => setOpenArticle(toView(email, color, heroManifest))}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
