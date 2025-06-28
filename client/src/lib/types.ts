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
