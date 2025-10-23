# 📈 Feature Development Roadmap (Next 1-2 months)

## Overview
This roadmap outlines feature enhancements that will improve user experience, add new capabilities, and position SubsBuzz for future growth.

## 🚨 Outstanding Issues

### Dark/Light Theme Toggle
**Status**: Partially implemented but not fully functional
**Issue**: Theme settings save to database but visual theme switching not working consistently
- Theme mode (light/dark/system) saves properly to database
- Theme colors (blue/green/purple/etc) save and apply correctly
- Main issue: Left sidebar and overall page background don't switch to dark mode
- Next-themes provider integration appears correct but CSS application inconsistent
- Tried multiple approaches: CSS custom properties, page wrapper backgrounds, !important rules
- **TODO**: Deep debug of CSS specificity and next-themes integration timing

## 1. Real-time Updates
**Priority**: High
**Timeline**: 3-4 weeks
**Impact**: User engagement, data freshness, competitive advantage

### Current State
- Manual refresh required for new digests
- No real-time notifications
- Polling-based updates inefficient

### Implementation Plan

#### WebSocket Integration
```typescript
// server/websocket.ts
import { WebSocketServer } from 'ws';

export class DigestWebSocket {
  private wss: WebSocketServer;
  private userConnections: Map<string, WebSocket[]> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.setupConnections();
  }

  broadcastDigestUpdate(userId: string, digest: any) {
    const connections = this.userConnections.get(userId) || [];
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'digest_update', data: digest }));
      }
    });
  }
}
```

#### Client-Side WebSocket
```typescript
// client/src/hooks/useWebSocket.ts
export const useWebSocket = (userId: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5500/ws?userId=${userId}`);
    
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // Handle real-time updates
    };
    
    setSocket(ws);
    return () => ws.close();
  }, [userId]);

  return { socket, isConnected };
};
```

### Features to Implement
- [ ] Real-time digest notifications
- [ ] Live email processing status
- [ ] Instant digest updates
- [ ] Connection status indicators
- [ ] Offline/online state handling

## 2. Advanced Personalization
**Priority**: Medium-High
**Timeline**: 2-3 weeks
**Impact**: User satisfaction, retention, differentiation

### Custom Digest Scheduling
```typescript
// shared/schema.ts - Enhanced user settings
export const userSettings = pgTable("user_settings", {
  // ... existing fields
  digestFrequency: text("digest_frequency").default("daily"), // daily, weekly, custom
  digestTime: text("digest_time").default("07:00"), // HH:MM format
  timezone: text("timezone").default("UTC"),
  weeklyDigestDay: integer("weekly_digest_day"), // 0-6 (Sunday-Saturday)
  customSchedule: jsonb("custom_schedule"), // Cron-like schedule
});
```

### Content Filtering
```typescript
// server/content-filter.ts
export class ContentFilter {
  async filterEmailsByPreferences(
    emails: DigestEmail[],
    preferences: UserPreferences
  ): Promise<DigestEmail[]> {
    return emails.filter(email => {
      // Filter by keywords
      if (preferences.excludeKeywords?.some(keyword => 
        email.subject.toLowerCase().includes(keyword.toLowerCase())
      )) return false;

      // Filter by sender reputation
      if (preferences.minimumSenderScore && 
          email.senderScore < preferences.minimumSenderScore) return false;

      // Filter by content type
      if (preferences.contentTypes && 
          !preferences.contentTypes.includes(email.contentType)) return false;

      return true;
    });
  }
}
```

### Implementation Tasks
- [ ] Add custom scheduling interface
- [ ] Implement timezone handling
- [ ] Create content filtering system
- [ ] Add keyword management
- [ ] Implement sender scoring
- [ ] Add digest format preferences

## 3. Progressive Web App Features
**Priority**: Medium
**Timeline**: 2-3 weeks
**Impact**: Mobile experience, user retention, accessibility

### PWA Implementation
```json
// client/public/manifest.json
{
  "name": "SubsBuzz - AI Email Digest",
  "short_name": "SubsBuzz",
  "description": "AI-powered email digest application",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### Service Worker
```typescript
// client/public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('subsbuzz-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/dashboard',
        '/history',
        '/settings',
        '/offline.html'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
      .catch(() => caches.match('/offline.html'))
  );
});
```

### Offline Support
```typescript
// client/src/hooks/useOffline.ts
export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOffline;
};
```

### Implementation Tasks
- [ ] Create PWA manifest
- [ ] Implement service worker
- [ ] Add offline page
- [ ] Create offline data caching
- [ ] Add push notifications
- [ ] Implement background sync

## 4. Enhanced AI Features
**Priority**: Medium
**Timeline**: 4-6 weeks
**Impact**: Differentiation, user value, competitive advantage

### Sentiment Analysis
```typescript
// server/ai/sentiment-analysis.ts
import { OpenAI } from 'openai';

export class SentimentAnalyzer {
  async analyzeSentiment(content: string): Promise<SentimentResult> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze the sentiment of the following email content. 
                   Return a JSON object with: 
                   - sentiment: "positive" | "negative" | "neutral"
                   - confidence: number (0-1)
                   - emotions: string[] (joy, anger, fear, etc.)
                   - tone: "professional" | "casual" | "urgent" | "promotional"`
        },
        { role: 'user', content }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }
}
```

### Trend Detection
```typescript
// server/ai/trend-detector.ts
export class TrendDetector {
  async detectTrends(emails: DigestEmail[], timeframe: string): Promise<Trend[]> {
    // Analyze keyword frequency over time
    const keywordFrequency = this.analyzeKeywordFrequency(emails);
    
    // Identify emerging topics
    const emergingTopics = this.identifyEmergingTopics(keywordFrequency);
    
    // Detect trending entities
    const trendingEntities = this.analyzeTrendingEntities(emails);
    
    return this.compileTrends(emergingTopics, trendingEntities);
  }
}
```

### Custom Categories
```typescript
// server/ai/custom-categorizer.ts
export class CustomCategorizer {
  async trainCustomCategories(
    userExamples: CategoryExample[],
    userId: string
  ): Promise<CategoryModel> {
    // Train a lightweight model based on user examples
    const trainingData = this.prepareTrainingData(userExamples);
    
    // Use OpenAI fine-tuning or local model
    const model = await this.trainModel(trainingData);
    
    // Store model for user
    await this.storeUserModel(userId, model);
    
    return model;
  }
}
```

### Implementation Tasks
- [ ] Add sentiment analysis to digest processing
- [ ] Implement trend detection algorithms
- [ ] Create custom category training
- [ ] Add emotion detection
- [ ] Implement tone analysis
- [ ] Add AI confidence scoring

## 5. Advanced Search & Filtering
**Priority**: Medium
**Timeline**: 2-3 weeks
**Impact**: User efficiency, data discovery, retention

### Full-Text Search
```typescript
// server/search/full-text-search.ts
export class FullTextSearch {
  async searchDigests(
    query: string,
    userId: string,
    filters: SearchFilters
  ): Promise<SearchResult[]> {
    const searchQuery = `
      SELECT DISTINCT de.*, ed.date
      FROM digest_emails de
      JOIN email_digests ed ON de.digest_id = ed.id
      WHERE ed.user_id = $1
      AND (
        to_tsvector('english', de.subject || ' ' || de.summary || ' ' || de.full_content) 
        @@ plainto_tsquery('english', $2)
      )
      ${this.buildFilterClauses(filters)}
      ORDER BY ed.date DESC
      LIMIT 50
    `;

    return await this.db.query(searchQuery, [userId, query, ...filters]);
  }
}
```

### Advanced Filters
```typescript
// client/src/components/search/AdvancedFilters.tsx
export const AdvancedFilters = () => {
  const [filters, setFilters] = useState({
    dateRange: { start: null, end: null },
    senders: [],
    topics: [],
    sentiment: 'all',
    importance: 'all'
  });

  return (
    <div className="space-y-4">
      <DateRangeFilter value={filters.dateRange} onChange={setDateRange} />
      <SenderFilter value={filters.senders} onChange={setSenders} />
      <TopicFilter value={filters.topics} onChange={setTopics} />
      <SentimentFilter value={filters.sentiment} onChange={setSentiment} />
      <ImportanceFilter value={filters.importance} onChange={setImportance} />
    </div>
  );
};
```

### Implementation Tasks
- [ ] Add full-text search capability
- [ ] Implement advanced filtering
- [ ] Create search suggestions
- [ ] Add saved searches
- [ ] Implement search analytics
- [ ] Add search result highlighting

## 6. Collaboration Features
**Priority**: Low-Medium
**Timeline**: 3-4 weeks
**Impact**: Team usage, viral growth, differentiation

### Digest Sharing
```typescript
// shared/schema.ts - Shared digests
export const sharedDigests = pgTable("shared_digests", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  sharedBy: text("shared_by").notNull(),
  sharedWith: text("shared_with").array(),
  shareToken: text("share_token").notNull().unique(),
  permissions: text("permissions").default("read"), // read, comment
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Comments System
```typescript
// shared/schema.ts - Comments
export const digestComments = pgTable("digest_comments", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  parentId: integer("parent_id"), // For threaded comments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Implementation Tasks
- [ ] Add digest sharing functionality
- [ ] Implement comments system
- [ ] Create team workspaces
- [ ] Add collaboration permissions
- [ ] Implement notification system
- [ ] Add activity feeds

## Implementation Priority Matrix

### High Impact, High Effort
- Real-time updates
- Enhanced AI features

### High Impact, Low Effort
- Advanced search
- Custom scheduling

### Medium Impact, Medium Effort
- PWA features
- Collaboration features

### Development Timeline

**Month 1**: Real-time updates, Advanced personalization
**Month 2**: PWA features, Enhanced AI features
**Month 3**: Advanced search, Collaboration features

## Success Metrics

### User Engagement
- 50% increase in daily active users
- 30% increase in session duration
- 25% increase in digest views

### Feature Adoption
- 70% of users enable real-time updates
- 40% of users customize digest scheduling
- 60% of users use advanced search

### Technical Metrics
- 99.9% WebSocket uptime
- <100ms search response time
- 95% PWA installation rate (where applicable)