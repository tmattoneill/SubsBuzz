export interface MonitoredEmail {
  id: number;
  email: string;
  active: boolean;
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
  subject: string;
  receivedAt: string;
  summary: string;
  fullContent: string;
  topics: string[];
  keywords: string[];
  originalLink?: string;
  isExpanded?: boolean;
}

export interface EmailDigest {
  id: number;
  date: string;
  emailsProcessed: number;
  topicsIdentified: number;
  emails: DigestEmail[];
}

export interface UserSettings {
  id: number;
  dailyDigestEnabled: boolean;
  topicClusteringEnabled: boolean;
  emailNotificationsEnabled: boolean;
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
  createdAt?: string;
}

export interface FullThematicDigest extends ThematicDigest {
  sections: ThematicSectionWithSourceEmails[];
}
