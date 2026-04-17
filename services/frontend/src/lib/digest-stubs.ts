import type { LucideIcon } from 'lucide-react';
import { TrendingUp, Briefcase, Zap, Globe, Cpu, Palette } from 'lucide-react';
import type { ArticleCardData } from '@/components/digest/ArticleCard';
import type { ArticleViewData } from '@/components/digest/ArticleView';

/**
 * Preview-only stub data for the `/digest-preview` routes.
 * Phase 3 replaces this with real ThematicDigest + DigestEmail data from the API.
 */

export interface Topic {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const topics: Topic[] = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'tech', label: 'Tech', icon: Cpu },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'innovation', label: 'Innovation', icon: Zap },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
];

export const heroArticle: ArticleViewData = {
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
  content: `
    <p>The landscape of productivity tools is undergoing a dramatic transformation. After analysing 180 newsletters from leading tech publications, we've identified three major trends that are reshaping how teams work.</p>

    <h2>Autonomous AI Agents Are Here</h2>
    <p>The dream of AI assistants that truly understand context and can act independently is becoming reality. Companies like Anthropic, OpenAI, and Google are racing to build agents that can manage entire workflows, from scheduling meetings to drafting reports, with minimal human oversight.</p>

    <p>Early adopters report time savings of up to 40% on routine administrative tasks. But the real value isn't just efficiency: it's the cognitive load reduction that allows knowledge workers to focus on strategic thinking and creative problem-solving.</p>

    <h2>Predictive Workflows Learn Your Patterns</h2>
    <p>Modern productivity tools don't just react to your commands. They anticipate your needs. Machine learning models trained on your work patterns can now suggest the next document you'll need, pre-populate meeting agendas based on participant history, and automatically prioritise your task list based on deadlines and importance.</p>

    <blockquote>
      <p>"We're moving from tools that wait for instructions to systems that proactively support your goals." — Sarah Chen, VP of Product at Notion</p>
    </blockquote>

    <h2>The Rise of Ambient Computing</h2>
    <p>Perhaps most transformative is the shift toward ambient computing: technology that fades into the background while continuously working on your behalf. Voice-first interfaces, always-listening AI assistants, and contextual notifications that appear exactly when needed are replacing the constant context-switching of traditional software.</p>

    <p>This isn't science fiction. It's already being deployed in progressive workplaces. The question isn't whether AI will transform productivity, but how quickly organisations can adapt to these new ways of working.</p>
  `,
  sources: [
    {
      name: 'Benedict Evans Newsletter',
      date: '2026-04-16',
      excerpt:
        'New AI agents from Anthropic demonstrate unprecedented ability to complete multi-step workflows autonomously...',
    },
    {
      name: 'Stratechery',
      date: '2026-04-15',
      excerpt:
        'The productivity stack is being rebuilt from first principles with AI at the core, not as an add-on feature...',
    },
    {
      name: 'The Verge',
      date: '2026-04-14',
      excerpt:
        'Google\'s latest Workspace updates show how predictive AI can reduce the friction in everyday tasks...',
    },
  ],
};

type ArticleStub = ArticleCardData & Partial<ArticleViewData>;

export const articles: ArticleStub[] = [
  {
    id: '2',
    title: 'Design Systems at Scale: Lessons from Figma',
    excerpt:
      'How the world\'s leading design platforms manage complexity across thousands of components.',
    image: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=800&q=80',
    topic: 'Design',
    date: '2026-04-17',
    readTime: '5 min read',
    tags: ['Design Systems', 'Figma'],
    size: 'large',
    content: `
      <p>Building a design system that scales from a handful of components to thousands while maintaining consistency and performance is one of the hardest challenges in modern product design.</p>

      <h2>The Component Explosion Problem</h2>
      <p>Figma's design system started with just 50 components. Today it encompasses over 3,000 variants across dozens of component families. The team learned that traditional approaches to component organisation break down at scale.</p>

      <h3>Three Key Principles</h3>
      <ol>
        <li><strong>Composability over customisation:</strong> Instead of creating variants for every use case, build atomic components that can be combined in flexible ways.</li>
        <li><strong>Progressive disclosure:</strong> Hide complexity from most users while making advanced features discoverable for power users.</li>
        <li><strong>Living documentation:</strong> Examples and usage guidelines must live alongside the components themselves, not in separate docs that go stale.</li>
      </ol>

      <h2>The Technology Stack</h2>
      <p>Figma's component library is built on a foundation of TypeScript, React, and a custom design token system that synchronises with their design files. This bidirectional sync ensures designers and engineers are always working from the same source of truth.</p>

      <blockquote>
        <p>"The best design system is the one that people actually use. That means optimising for ease of adoption over theoretical purity." — Dylan Field, Figma CEO</p>
      </blockquote>

      <p>The results speak for themselves: teams using Figma's design system ship features 3x faster and report 65% fewer design-related bugs in production.</p>
    `,
    sources: [
      {
        name: 'Figma Blog',
        date: '2026-04-17',
        excerpt:
          'Our journey from 50 to 3,000 components: lessons learned building a design system at scale...',
      },
      {
        name: 'Designer News',
        date: '2026-04-16',
        excerpt:
          'Interview with Figma\'s design systems team on maintaining consistency across thousands of variants...',
      },
    ],
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
    content: `
      <p>Climate tech is having its moment. After years of false starts, both venture capital and corporate investment are flooding into startups building solutions to the climate crisis.</p>

      <h2>The Numbers Tell the Story</h2>
      <p>In 2025, climate tech startups raised $50.3 billion across 1,200+ deals, more than the previous three years combined. But more important than the total is where the money is going.</p>

      <h3>Three Breakthrough Areas</h3>
      <p><strong>Carbon capture and sequestration</strong> has moved from science experiment to viable business model. Companies like Climeworks and Carbon Engineering are building plants that can remove CO2 from the atmosphere at under $100 per tonne.</p>

      <p><strong>Alternative proteins</strong> are reaching cost parity with traditional meat. A second wave of startups is making the technology commercially viable through fermentation and cell culture techniques.</p>

      <p><strong>Grid-scale energy storage</strong> is solving the intermittency problem that has held back renewable energy adoption. New battery chemistries and mechanical storage systems can now store energy for weeks, not hours.</p>

      <blockquote>
        <p>"Climate tech isn't a charity case anymore. These are some of the best returning investments in our portfolio." — Katie Rae, Managing Partner at The Engine</p>
      </blockquote>
    `,
    sources: [
      {
        name: 'PitchBook Climate Tech Report',
        date: '2026-04-15',
        excerpt:
          '$50B invested in climate tech in 2025, with carbon capture and alternative proteins leading...',
      },
      {
        name: 'TechCrunch',
        date: '2026-04-14',
        excerpt:
          'Why climate tech is finally having its moment: investors see path to returns...',
      },
    ],
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

export function articleToView(stub: ArticleStub): ArticleViewData {
  return {
    id: stub.id,
    title: stub.title,
    summary: stub.summary ?? stub.excerpt,
    content: stub.content ?? `<p>${stub.excerpt}</p>`,
    image: stub.image,
    topic: stub.topic,
    date: stub.date,
    readTime: stub.readTime,
    tags: stub.tags,
    emailCount: stub.emailCount,
    sources: stub.sources,
  };
}

export function findArticle(id: string): ArticleStub | undefined {
  return articles.find((a) => a.id === id);
}
