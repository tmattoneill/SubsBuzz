export interface MonitoredEmail {
  id: number;
  email: string;
  active: boolean;
}

export interface NewsletterSender {
  email: string;
  name: string;
  count: number;
  latestSubject: string;
  hasUnsubscribe: boolean;
}

export interface Topic {
  name: string;
  isSelected: boolean;
}

export interface DigestStats {
  emailsProcessed: number;
  topicsIdentified: number;
  sourcesMonitored: number;
}

export interface DigestEmail {
  id: number;
  digestId: number;
  sender: string;
  source?: string;     // Display name of sender
  subject: string;
  receivedAt: string;
  snippet?: string;    // ≤25-word summary
  summary: string;
  fullContent: string;
  topics: string[];
  keywords: string[];
  originalLink?: string;
  heroImageUrl?: string | null;  // Extracted from raw email HTML by email-worker. NULL for pre-feature rows.
  isExpanded?: boolean;
}

export interface EmailDigest {
  id: number;
  date: string;
  emailsProcessed: number;
  topicsIdentified: number;
  emails: DigestEmail[];
}

// Inbox cleanup action enum. Keep in sync with:
// - services/data-server/src/db/schema.ts (userSettings.inboxCleanupAction)
// - services/api-gateway/routes/settings.py (INBOX_CLEANUP_ACTIONS)
// - services/email-worker/tasks.py (CLEANUP_ACTIONS)
export type InboxCleanupAction =
  | "none"
  | "mark_read"
  | "mark_read_archive"
  | "mark_read_label_archive"
  | "trash";

export interface UserSettings {
  id: number;
  dailyDigestEnabled: boolean;
  topicClusteringEnabled: boolean;
  emailNotificationsEnabled: boolean;
  themeMode?: string; // "light", "dark", "system"
  themeColor?: string; // "blue", "green", "purple", "teal", "red", "orange"
  firstName?: string | null;
  lastName?: string | null;
  location?: string | null;
  openaiApiKey?: string | null;
  inboxCleanupAction?: InboxCleanupAction;
  inboxCleanupLabelName?: string | null;
}

// Thematic digest types for new meta-summary system
export interface ThematicSection {
  id: number;
  thematicDigestId: number;
  theme: string;
  summary: string;
  confidence?: number;
  keywords?: string[];
  entities?: any; // JSON object for named entities
  order: number;
}

export interface ThemeSourceEmail {
  id: number;
  thematicSectionId: number;
  digestEmailId: number;
  relevanceScore?: number;
}

export interface ThematicSectionWithSourceEmails extends ThematicSection {
  sourceEmails: (ThemeSourceEmail & { email: DigestEmail })[];
}

export interface ThematicDigest {
  id: number;
  userId: string;
  date: string;
  emailDigestId: number;
  sectionsCount: number;
  totalSourceEmails: number;
  processingMethod: string;
  dailySummary?: string;
  createdAt?: string;
}

export interface FullThematicDigest extends ThematicDigest {
  sections: ThematicSectionWithSourceEmails[];
}

export interface DigestKanbanCard {
  id: string | number;
  title: string;
  description: string;
  dateLabel: string;
  dateISO: string;
  emailsProcessed: number;
  topicsIdentified: number;
  type?: "regular" | "thematic";
  sectionsCount?: number;
  isHighlighted?: boolean;
}

export interface DigestKanbanColumn {
  id: string;
  title: string;
  count: number;
  cards: DigestKanbanCard[];
}

export interface ChartDataPoint {
  name: string;
  value: number;
}
