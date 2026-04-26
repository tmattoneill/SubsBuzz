import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Loader2, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { DigestEmail, FullThematicDigest } from "@/lib/types";
import { useCategories } from "@/hooks/useCategories";
import {
  warmHeroManifest,
  getArticleHeroFallbackSync,
  isGoodHeroUrl,
  type HeroManifest,
} from "@/lib/article-heroes";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout";
import { HeroArticle, type HeroArticleData } from "@/components/digest/HeroArticle";
import { ArticleCard, type ArticleCardData } from "@/components/digest/ArticleCard";
import {
  ArticleView,
  type ArticleViewData,
  type ArticleSource,
} from "@/components/digest/ArticleView";

// Rough read-time computed from content length. 1000 chars ≈ 1 minute.
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

function categoryFor(email: DigestEmail, liveColor: string | null | undefined) {
  const name = email.categoryNameSnapshot ?? null;
  const slug = email.categorySlugSnapshot ?? null;
  return { name, slug, color: liveColor ?? null };
}

function emailToCard(
  email: DigestEmail,
  liveColor: string | null | undefined,
  manifest: HeroManifest | null,
): ArticleCardData {
  const cat = categoryFor(email, liveColor);
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
    categoryName: cat.name,
    categorySlug: cat.slug,
    categoryColor: cat.color,
  };
}

function emailToView(
  email: DigestEmail,
  liveColor: string | null | undefined,
  manifest: HeroManifest | null,
): ArticleViewData {
  const body = email.summaryHtml
    ? email.summaryHtml
    : `<p>${escapeHtml(email.summary)}</p>`;
  const cat = categoryFor(email, liveColor);

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
    categoryName: cat.name,
    categorySlug: cat.slug,
    categoryColor: cat.color,
  };
}

function collectEmailsFromThematic(d: FullThematicDigest): DigestEmail[] {
  const byId = new Map<number, DigestEmail>();
  for (const section of d.sections ?? []) {
    for (const link of section.sourceEmails ?? []) {
      if (link.email && !byId.has(link.email.id)) {
        byId.set(link.email.id, link.email);
      }
    }
  }
  return Array.from(byId.values());
}

function thematicToHero(
  d: FullThematicDigest,
  emails: DigestEmail[],
  manifest: HeroManifest | null,
): HeroArticleData | null {
  if (!d.dailySummary) return null;
  const heroImage =
    emails.find((e) => isGoodHeroUrl(e.heroImageUrl))?.heroImageUrl ??
    getArticleHeroFallbackSync(manifest, "digest-cover", "16_9");
  return {
    id: `thematic-${d.id}`,
    title: "Your Daily Intelligence Brief",
    summary: d.dailySummary,
    image: heroImage,
    topic: "Meta Summary",
    date: d.date,
    readTime: computeReadTime(d.dailySummary),
    tags: [],
    emailCount: emails.length,
  };
}

function thematicToView(
  d: FullThematicDigest,
  emails: DigestEmail[],
  manifest: HeroManifest | null,
): ArticleViewData {
  // Render the daily summary as the deck, then each section's theme + summary
  // as an h3 + paragraph block. ArticleView splits on the first h3 to place
  // the hero image between deck and sections.
  const deck = d.dailySummary ? `<p>${d.dailySummary}</p>` : "";
  const sections = (d.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(
      (s) => `<h3>${s.theme}</h3>\n<p>${(s.summary || "").replace(/\n{2,}/g, "</p><p>")}</p>`,
    )
    .join("\n\n");

  const content = [deck, sections].filter(Boolean).join("\n\n") || `<p>${d.dailySummary ?? ""}</p>`;

  const sources: ArticleSource[] = emails.slice(0, 10).map((e) => ({
    name: topicFor(e),
    date: e.receivedAt,
    excerpt: e.snippet || e.summary,
    senderEmail: e.sender,
    subject: e.subject,
    originalLink: e.originalLink,
  }));

  const heroImage =
    emails.find((e) => isGoodHeroUrl(e.heroImageUrl))?.heroImageUrl ??
    getArticleHeroFallbackSync(manifest, "digest-cover", "16_9");

  return {
    id: `thematic-${d.id}`,
    title: "Your Daily Intelligence Brief",
    content,
    image: heroImage,
    topic: "Meta Summary",
    date: d.date,
    readTime: computeReadTime(d.dailySummary),
    tags: [],
    emailCount: emails.length,
    sources,
  };
}

const CATEGORY_UNSET = "__uncategorized__";

export default function DigestView() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/digest/:date");
  const [openArticle, setOpenArticle] = useState<ArticleViewData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { data: userCategories = [] } = useCategories();

  const dateParam = params?.date;

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (!match || !dateParam) {
      setLocation("/dashboard");
    }
  }, [match, dateParam, setLocation]);

  const {
    data: digestData,
    isLoading: isDigestLoading,
    isError: isDigestError,
  } = useQuery<FullThematicDigest | { type?: string; date: string; emails: DigestEmail[] }>({
    queryKey: ["/api/digest/date", dateParam],
    enabled: !!dateParam,
    refetchOnWindowFocus: false,
  });

  const { data: heroManifest = null } = useQuery<HeroManifest | null>({
    queryKey: ["article-hero-manifest"],
    queryFn: warmHeroManifest,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Shape-derived values. Fall back safely when the API response is shaped
  // as either a FullThematicDigest or a basic EmailDigest with an `emails` array.
  const { heroArticle, gridEmails, thematicViewData, isThematic } = useMemo(() => {
    if (!digestData) {
      return {
        heroArticle: null as HeroArticleData | null,
        gridEmails: [] as DigestEmail[],
        thematicViewData: null as ArticleViewData | null,
        isThematic: false,
      };
    }
    const isThematicResp =
      (digestData as any).type === "thematic" ||
      Array.isArray((digestData as FullThematicDigest).sections);

    if (isThematicResp) {
      const t = digestData as FullThematicDigest;
      const emails = collectEmailsFromThematic(t);
      const hero = thematicToHero(t, emails, heroManifest);
      const view = thematicToView(t, emails, heroManifest);
      return {
        heroArticle: hero,
        gridEmails: emails,
        thematicViewData: view,
        isThematic: true,
      };
    }

    const basic = digestData as { emails?: DigestEmail[] };
    return {
      heroArticle: null,
      gridEmails: basic.emails ?? [],
      thematicViewData: null,
      isThematic: false,
    };
  }, [digestData, heroManifest]);

  const digestDate = useMemo(
    () => (digestData?.date ? new Date(digestData.date) : null),
    [digestData?.date],
  );

  const categoryColorById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of userCategories) if (c.color) map.set(c.id, c.color);
    return map;
  }, [userCategories]);

  const chipRow = useMemo(() => {
    const counts = new Map<
      string,
      { key: string; name: string; count: number; color: string | null }
    >();
    for (const e of gridEmails) {
      const name = e.categoryNameSnapshot ?? null;
      const key = name ? (e.categorySlugSnapshot ?? name) : CATEGORY_UNSET;
      const display = name ?? "Uncategorized";
      const color =
        (e.categoryId && categoryColorById.get(e.categoryId)) || null;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { key, name: display, count: 1, color });
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [gridEmails, categoryColorById]);

  const filteredEmails = useMemo(() => {
    if (!activeCategory) return gridEmails;
    if (activeCategory === CATEGORY_UNSET) {
      return gridEmails.filter((e) => !e.categoryNameSnapshot);
    }
    return gridEmails.filter(
      (e) =>
        (e.categorySlugSnapshot ?? e.categoryNameSnapshot) === activeCategory,
    );
  }, [gridEmails, activeCategory]);

  if (authLoading || isDigestLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading digest…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isDigestError || !digestData) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 p-12 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            No digest found for {dateParam}
          </h2>
          <p className="text-sm text-muted-foreground">
            There isn&apos;t a digest available for this date yet. Try another day from your
            history.
          </p>
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

  const todayLabel = digestDate
    ? digestDate.toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : dateParam;

  return (
    <DashboardLayout>
      <div className="story-theme palette-terracotta min-h-full bg-background">
        <main className="max-w-[1600px] mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8">
              {isThematic && (
                <motion.div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <TrendingUp className="size-4 text-accent" />
                  <span className="font-body text-sm font-medium text-accent">
                    Today&rsquo;s Meta Summary
                  </span>
                </motion.div>
              )}
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-2">
                Your Daily Intelligence Brief
              </h2>
              <p className="font-body text-muted-foreground text-lg">{todayLabel}</p>
            </div>

            {heroArticle && thematicViewData && (
              <div onClick={() => setOpenArticle(thematicViewData)}>
                <HeroArticle
                  article={heroArticle}
                  onRead={() => setOpenArticle(thematicViewData)}
                />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-3xl font-bold">Latest from Your Sources</h2>
              <p className="font-body text-muted-foreground">
                {filteredEmails.length}{" "}
                {filteredEmails.length === 1 ? "article" : "articles"}
                {activeCategory ? " filtered" : ""}
              </p>
            </div>

            {chipRow.length > 1 ? (
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border transition",
                    activeCategory == null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                {chipRow.map((chip) => {
                  const active = activeCategory === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setActiveCategory(active ? null : chip.key)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border transition inline-flex items-center gap-1.5",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {chip.name} · {chip.count}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {filteredEmails.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-12 text-center">
                <p className="font-body text-muted-foreground">
                  {activeCategory
                    ? "No articles in this category for this digest."
                    : "No emails found in this digest."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEmails.map((email, index) => {
                  const liveColor =
                    (email.categoryId && categoryColorById.get(email.categoryId)) || null;
                  const card = emailToCard(email, liveColor, heroManifest);
                  // Give the first card a large slot for visual rhythm when there are enough emails.
                  const size: ArticleCardData["size"] =
                    index === 0 && filteredEmails.length >= 3 ? "large" : "medium";
                  const cardWithSize = { ...card, size };
                  return (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.5 + index * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={size === "large" ? "md:col-span-2" : "md:col-span-1"}
                    >
                      <ArticleCard
                        article={cardWithSize}
                        onRead={() => setOpenArticle(emailToView(email, liveColor, heroManifest))}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </DashboardLayout>
  );
}
