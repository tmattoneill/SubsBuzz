import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Loader2, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { DigestEmail, FullThematicDigest } from "@/lib/types";
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

function emailToCard(email: DigestEmail): ArticleCardData {
  return {
    id: String(email.id),
    title: email.subject,
    excerpt: email.snippet || email.summary,
    image: email.heroImageUrl ?? null,
    topic: topicFor(email),
    date: email.receivedAt,
    readTime: computeReadTime(email.fullContent),
    tags: email.topics?.slice(0, 4) ?? [],
  };
}

function emailToView(email: DigestEmail): ArticleViewData {
  // Render plain-text fullContent as simple paragraphs. Real HTML support later.
  const paragraphs = (email.fullContent || email.summary)
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return {
    id: String(email.id),
    title: email.subject,
    summary: email.summary,
    content: paragraphs || `<p>${email.summary}</p>`,
    image: email.heroImageUrl ?? null,
    topic: topicFor(email),
    date: email.receivedAt,
    readTime: computeReadTime(email.fullContent),
    tags: email.topics ?? [],
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
  sourceCount: number,
): HeroArticleData | null {
  if (!d.dailySummary) return null;
  return {
    id: `thematic-${d.id}`,
    title: "Your Daily Intelligence Brief",
    summary: d.dailySummary,
    image: null, // no aggregate hero image; gradient plate renders
    topic: "Meta Summary",
    date: d.date,
    readTime: computeReadTime(d.dailySummary),
    tags: [],
    emailCount: sourceCount,
  };
}

function thematicToView(
  d: FullThematicDigest,
  emails: DigestEmail[],
): ArticleViewData {
  // Render each section's theme + summary as an H2 + paragraph block.
  const sections = (d.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(
      (s) => `<h2>${s.theme}</h2>\n<p>${(s.summary || "").replace(/\n{2,}/g, "</p><p>")}</p>`,
    )
    .join("\n\n");

  const sources: ArticleSource[] = emails.slice(0, 10).map((e) => ({
    name: topicFor(e),
    date: e.receivedAt,
    excerpt: e.snippet || e.summary,
  }));

  return {
    id: `thematic-${d.id}`,
    title: "Your Daily Intelligence Brief",
    summary: d.dailySummary,
    content: sections || `<p>${d.dailySummary ?? ""}</p>`,
    image: null,
    topic: "Meta Summary",
    date: d.date,
    readTime: computeReadTime(d.dailySummary),
    tags: [],
    emailCount: emails.length,
    sources,
  };
}

export default function DigestView() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/digest/:date");
  const [openArticle, setOpenArticle] = useState<ArticleViewData | null>(null);

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
      const hero = thematicToHero(t, emails.length);
      const view = thematicToView(t, emails);
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
  }, [digestData]);

  const digestDate = useMemo(
    () => (digestData?.date ? new Date(digestData.date) : null),
    [digestData?.date],
  );

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
                {gridEmails.length}{" "}
                {gridEmails.length === 1 ? "article" : "articles"}
              </p>
            </div>

            {gridEmails.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-12 text-center">
                <p className="font-body text-muted-foreground">
                  No emails found in this digest.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridEmails.map((email, index) => {
                  const card = emailToCard(email);
                  // Give the first card a large slot for visual rhythm when there are enough emails.
                  const size: ArticleCardData["size"] =
                    index === 0 && gridEmails.length >= 3 ? "large" : "medium";
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
                        onRead={() => setOpenArticle(emailToView(email))}
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
