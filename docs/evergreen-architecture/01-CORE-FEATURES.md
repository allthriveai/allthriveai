# Core Features

**Source of Truth** | **Last Updated**: 2025-11-29

This document defines the core features of AllThrive AI. These features represent the fundamental value proposition and should remain stable across iterations.

---

## Feature Hierarchy

```
AllThrive AI
├── Discovery & Exploration
├── Portfolio & Showcase
├── Learning & Progression
├── Community & Social
├── AI Agents & Automation
└── Integrations & Tools
```

---

## 1. Discovery & Exploration

### 1.1 Project Discovery
**Purpose**: Help users discover inspiring AI projects from the community.

**Components**:
- **For You Feed**: Personalized recommendations based on user interests, activity, and Thrive Circle
- **Trending Tab**: Real-time trending projects based on community engagement
- **All Projects Feed**: Complete catalog with advanced filtering
- **Search**: Full-text search across projects, tools, and topics

**Key Models**: `Project`, `User`, `Topic`, `Tool`

**Privacy**: Respects user privacy settings (public/private/unlisted)

---

### 1.2 AI Tool Directory
**Purpose**: Curated directory of 200+ AI tools with real-world examples.

**Components**:
- Tool catalog with categories and tags
- Example projects for each tool
- Tool comparisons and recommendations
- Integration status indicators

**Key Models**: `Tool`, `ToolCategory`, `ToolTag`, `ToolExample`

---

## 2. Portfolio & Showcase

### 2.1 User Profiles
**Purpose**: Professional portfolio for AI builders.

**Components**:
- Public profile page (`/{username}`)
- Bio, avatar, social links
- Featured projects section
- Activity timeline
- Achievement badges
- Thrive Circle status

**Key Models**: `User`, `UserProfile`, `Achievement`

**Privacy Levels**:
- **Public**: Visible to everyone, crawlable by search engines
- **Unlisted**: Accessible via direct link, not in feeds
- **Private**: Only visible to owner

---

### 2.2 Project Management
**Purpose**: Showcase and organize AI projects.

**Components**:
- Project CRUD operations
- Rich markdown descriptions with Mermaid diagram support
- Media attachments (images, videos via YouTube)
- Tool tagging
- Topic categorization
- Comments and likes
- Privacy controls

**Key Models**: `Project`, `ProjectMedia`, `ProjectTool`, `Comment`, `Like`

**URL Structure**: `/{username}/{project-slug}`

---

## 3. Learning & Progression

### 3.1 Thrive Circles
**Purpose**: Community tiers based on engagement and contribution.

**Tiers** (in order):
1. **Seedling** (0-99 points)
2. **Sprout** (100-499 points)
3. **Blossom** (500-999 points)
4. **Bloom** (1000-4999 points)
5. **Evergreen** (5000+ points)

**Point Sources**:
- Project creation: 50 points
- Daily login streak: Variable
- Quiz completion: Variable
- Community engagement: Variable
- Achievements: Variable

**Key Models**: `ThriveCircle`, `ThriveCircleMembership`, `PointTransaction`

---

### 3.2 Interactive Quizzes
**Purpose**: Gamified learning across AI/ML topics.

**Quiz Types**:
- True/False
- Multiple Choice
- Swipe-based (mobile-optimized)

**Features**:
- Topic-based categorization
- Difficulty levels
- Progress tracking
- Streak rewards
- XP and point rewards

**Key Models**: `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`

**URL Structure**: `/quick-quizzes/{slug}`

---

### 3.3 Achievement System
**Purpose**: Recognize milestones and encourage engagement.

**Achievement Categories**:
- **Milestones**: First project, 10 projects, etc.
- **Engagement**: Comments, likes, shares
- **Learning**: Quiz completions, streaks
- **Community**: Helping others, collaboration
- **Special**: Event participation, seasonal

**Key Models**: `Achievement`, `UserAchievement`, `AchievementCriteria`

---

### 3.4 Side Quests
**Purpose**: Optional challenges for extra rewards.

**Quest Types**:
- Quiz Mastery
- Project Showcase
- Community Helper
- Learning Streak
- Weekly Build Challenges

**Key Models**: `SideQuest`, `UserQuest`, `QuestProgress`

---

## 4. Community & Social

### 4.1 Comments & Feedback
**Purpose**: Enable discussion and peer feedback.

**Features**:
- Threaded comments on projects
- Markdown support
- Like/upvote system
- Moderation tools
- Notifications

**Key Models**: `Comment`, `CommentLike`

---

### 4.2 Social Interactions
**Purpose**: Build community connections.

**Features**:
- Follow/unfollow users
- Activity feed
- Notifications (in-app)
- @ mentions
- Sharing projects

**Key Models**: `Follow`, `Notification`, `ActivityLog`

---

### 4.3 Events & Webinars
**Purpose**: Community learning and networking.

**Event Types**:
- Webinars
- Topic discussions
- Builder interviews
- Build challenges
- Office hours

**Key Models**: `Event`, `EventRegistration`, `EventAttendance`

---

## 5. AI Agents & Automation

### 5.1 Project Chat Agent
**Purpose**: AI-powered assistant for project creation and management.

**Capabilities**:
- Project ideation
- Structured data extraction from conversations
- Markdown generation
- Tool recommendations
- Import assistance (GitHub, YouTube)

**Architecture**: LangGraph multi-agent system

**Key Components**: `ChatConsumer`, `process_chat_message_task`, `project_agent`

**Communication**: WebSocket (real-time streaming)

---

### 5.2 Curation Agents
**Purpose**: AI agents that curate community content.

**Agent Types**:
- News aggregator
- Project recommender
- Topic expert agents
- Trend analyzer

**Key Models**: `Agent`, `AgentMessage`, `CuratedContent`

---

## 6. Integrations & Tools

### 6.1 GitHub Integration
**Purpose**: Auto-sync projects from GitHub repositories.

**Features**:
- OAuth authentication
- Repository import
- README parsing
- Technology detection
- Privacy inheritance
- Webhook support (future)

**Key Models**: `GitHubIntegration`, `ImportedRepository`

**API**: GitHub REST API v4

---

### 6.2 YouTube Integration
**Purpose**: Embed and sync video content.

**Features**:
- Video embedding
- Metadata extraction
- Thumbnail generation
- Playlist support

**Key Models**: `YouTubeVideo`, `VideoMetadata`

**API**: YouTube Data API v3

---

### 6.3 OAuth Providers
**Purpose**: Social authentication and account linking.

**Supported Providers**:
- Google (authentication)
- GitHub (authentication + integration)
- GitLab (future)
- LinkedIn (future)
- Figma (future)
- Hugging Face (future)

**Authentication Flow**: OAuth 2.0 with JWT

**Key Models**: `SocialAccount`, `SocialApp`

---

## 7. Marketplace (Future)

### 7.1 Creator Marketplace
**Purpose**: Monetize AI prompts, courses, and templates.

**Components**:
- Product listings
- Secure checkout
- Creator payouts
- Reviews and ratings
- License management

**Status**: Planned

---

## Feature Flags

Some features can be enabled/disabled via configuration:

| Feature | Default | Environment Variable |
|---------|---------|---------------------|
| GitHub Integration | Enabled | `ENABLE_GITHUB_INTEGRATION` |
| YouTube Integration | Enabled | `ENABLE_YOUTUBE_INTEGRATION` |
| AI Chat Agent | Enabled | `ENABLE_AI_AGENTS` |
| Quizzes | Enabled | `ENABLE_QUIZZES` |
| Marketplace | Disabled | `ENABLE_MARKETPLACE` |

---

## Design Principles

1. **Privacy First**: Users control visibility of all content
2. **AI-Augmented**: AI assists but doesn't replace human creativity
3. **Community-Driven**: Features encourage collaboration and sharing
4. **Progressive Disclosure**: Advanced features revealed as users progress
5. **Mobile-First**: Optimized for mobile experience
6. **Performance**: Fast loading, real-time updates where appropriate

---

## User Journeys

### New User Journey
1. Sign up via Google/GitHub OAuth
2. See onboarding chat agent
3. Create first project (manual or imported)
4. Join Seedling Thrive Circle
5. Discover For You feed
6. Take first quiz
7. Unlock first achievement

### Power User Journey
1. Multiple projects with rich media
2. High Thrive Circle tier (Bloom/Evergreen)
3. Active community participation (comments, likes)
4. Regular quiz participation
5. Achievement collector
6. Multiple integrations connected
7. Referrals and community growth

---

## Non-Goals

What AllThrive AI is **NOT**:
- ❌ Code hosting platform (use GitHub)
- ❌ Video hosting platform (use YouTube)
- ❌ Full-featured CMS
- ❌ Collaboration workspace (Notion/Figma alternative)
- ❌ AI model training platform

---

## Success Metrics

| Feature Area | Key Metric |
|--------------|-----------|
| Discovery | Daily active project views |
| Portfolio | Projects created per user |
| Learning | Quiz completion rate |
| Community | Comments per project |
| AI Agents | Chat sessions initiated |
| Integrations | Connected accounts per user |

---

**Version**: 1.0  
**Status**: Stable  
**Review Cadence**: Quarterly
