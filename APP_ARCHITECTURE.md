# App Architecture Analysis: Lahazaat

## Overview

**Lahazaat** is a modern Next.js 16 application that provides a content management and publishing platform with interactive games. It features article submission and management workflows, a Wordle game with player statistics tracking, theme switching, and email notifications powered by Supabase and Resend.

---

## Tech Stack

- **Framework**: Next.js 16.2.1
- **Frontend UI**: React 19.2.4 + React DOM 19.2.4
- **Styling**: Tailwind CSS 4.2.2 + PostCSS 4
- **Backend**: Next.js API Routes + Supabase PostgreSQL
- **Database**: PostgreSQL (Supabase) with Row-Level Security
- **Auth**: Supabase Auth (Google OAuth)
- **Email**: Resend 6.9.4
- **Rich Text Editor**: React Quill 2.0.0 + DOMPurify 3.3.3
- **Image Optimization**: Next.js Image component with Unsplash CDN
- **Development**: Babel React Compiler, ESLint 9.39.4, Playwright testing

---

## File Structure Tree

```
lahazaat/
├── src/
│   ├── pages/                           # Next.js page routes
│   │   ├── _app.js                      # Global app wrapper, theme management, Navbar/Footer layout
│   │   ├── _document.js                 # HTML document structure
│   │   ├── index.js                     # HOME: Feed of published articles (NewsCard grid)
│   │   ├── articles.js                  # ARTICLES: Archive page with all published articles
│   │   ├── games.js                     # GAMES: Hub page with game links
│   │   ├── submit.js                    # SUBMIT: Article submission form (auth required)
│   │   ├── globals.css                  # Global styles + theme CSS variables
│   │   ├── admin/
│   │   │   └── index.js                 # ADMIN: Dashboard for editing/publishing drafts (admin-only)
│   │   ├── api/
│   │   │   └── notify.js                # POST /api/notify - Email notification handler
│   │   ├── games/
│   │   │   └── wordle.js                # WORDLE: Daily 5-letter word game with stats
│   │   └── news/
│   │       └── [slug].js                # ARTICLE DETAIL: Display single published article
│   │
│   ├── components/                      # Shared React components
│   │   ├── Navbar.js                    # Top navigation, theme switcher, auth, search
│   │   ├── Footer.js                    # Footer component
│   │   ├── NewsCard.js                  # Reusable article card (image + meta)
│   │   ├── ClientRichTextEditor.js      # Rich text editor wrapper (client-side only)
│   │   ├── WordleGrid.js                # Wordle game grid display (6 rows × 5 tiles)
│   │   └── WordleKeyboard.js            # Wordle keyboard input interface
│   │
│   ├── lib/                             # Utilities & services
│   │   ├── supabase.js                  # Supabase client initialization
│   │   ├── articles.js                  # Functions: getPublishedArticles(), getArticleBySlugOrId()
│   │   └── validWords.js                # Set of 5-letter words for Wordle validation
│   │
│   └── styles/                          # Additional styles (if any)
│
├── supabase/                            # Supabase configuration
│   ├── config.toml                      # Local Supabase CLI config
│   ├── migrations/                      # Database migrations (version-controlled)
│   │   ├── 20260327193000_initial_schema.sql
│   │   ├── 20260328000000_add_profiles_table.sql
│   │   └── 20260329000000_sync_profiles_from_auth_users.sql
│   ├── seed.sql                         # Database seed data
│   └── snippets/                        # SQL query snippets (dev reference)
│
├── scripts/                             # Utility scripts
│   └── rebuild-local-supabase.sh        # Rebuild local Supabase instance
│
├── public/                              # Static assets
├── next.config.mjs                      # Next.js configuration
├── tailwind.config.mjs                  # Tailwind CSS config (v4)
├── postcss.config.mjs                   # PostCSS config
├── eslint.config.mjs                    # ESLint config
├── jsconfig.json                        # JS path aliases
├── package.json                         # Dependencies & scripts
├── package-lock.json
├── lahazaat.code-workspace              # VS Code workspace config
├── .env.local                           # Local environment variables (secrets)
├── AGENTS.md                            # Custom agent rules
└── CLAUDE.md                            # Copilot instructions reference
```

---

## Core Functions & Processes

### 🏠 **HomePage** (`src/pages/index.js`)
**Purpose**: Display feed of published articles
- **Init**: `useEffect` → `getPublishedArticles()` → fetch from Supabase
- **State**: `news[]`, `errorMessage`
- **Render**: Grid of `NewsCard` components
- **RLS Policy**: Anyone can see `is_published=true` articles

### 📚 **ArticlesPage** (`src/pages/articles.js`)
**Purpose**: Archive view of all published articles (identical to homepage)
- **Functions**: Same as HomePage
- **UX**: Same grid layout

### 🎮 **GamesPage** (`src/pages/games.js`)
**Purpose**: Hub for interactive games
- **Content**: Links to available games (currently only Wordle)
- **Static**: No database calls

### 🎯 **WordlePage** (`src/pages/games/wordle.js`)
**Purpose**: Daily Wordle game with player statistics tracking
**Key Functions**:
1. **`getTodayDateString()`** → Format: `YYYY-MM-DD`
2. **`getPreviousDateString(dateString)`** → Calculate yesterday
3. **`evaluateGuess(guess, target)`** → Compare guess to solution, return per-letter states (`correct|present|absent`)
4. **`buildKeyboardStatuses(guesses)`** → Track which keys have been tried (color coding)
5. **`calculateNextCurrentStreak(result, priorStats, yesterday)`** → Update streak if won today
6. **`persistGameResult(result, guessCount)`** → UPSERT `game_stats` with updated metrics
7. **`submitGuess()`** → Validate guess, evaluate, lock game if won/lost, update stats

**Game Flow**:
- Load user session + today's `daily_words` row
- If played today: lock game, show result
- If first play: unlock, show "Guess the five-letter word"
- User types → Submit guess → Validate against `validWords` set → Evaluate → Update UI → Upsert stats on game end

### 📝 **SubmitPage** (`src/pages/submit.js`)
**Purpose**: Authenticated users submit article drafts
**Key Functions**:
1. **`stripHtml(value)`** → Remove HTML tags for plain text extract
2. **`buildSlug(title)`** → Sanitize title into URL-friendly slug
3. **`buildSlugWithSuffix(baseSlug, suffix)`** → Append uniqueness suffix
4. **`createSlugSuffix()`** → Generate timestamp-based unique ID
5. **`handleSubmit(event)`** → Validate form → INSERT draft → Call `/api/notify`

**Workflow**:
- Check auth session
- Load `categories` dropdown
- User fills: title, category, content (rich editor)
- Submit → Validate → Attempt 3x INSERT with slug collision retry
- On success: Call `/api/notify` → POST to Resend → Show success

### 🔐 **AdminDashboard** (`src/pages/admin/index.js`)
**Purpose**: Edit and publish article drafts (admin-only)
**Key Functions**:
1. **`loadDrafts()`** → Query `articles WHERE author_id = current_user.id`
2. **`loadCategories()`** → Fetch category list
3. **`openDraft(draft)`** → Populate editor with draft content
4. **`saveDraft()`** → UPDATE article with new title/category/content
5. **`publishDraft(draftId)`** → UPDATE `is_published=true` + NOTIFY Slack (if configured)
6. **`deleteDraft(draftId)`** → DELETE article

**UI**:
- Sidebar list of drafts
- Central rich-text editor
- Publish/Save/Delete buttons
- Toast notifications

### 📖 **ArticleDetailPage** (`src/pages/news/[slug].js`)
**Purpose**: Display single published article with sanitized HTML content
**Key Functions**:
1. **`fetchArticle()`** → `getArticleBySlugOrId(slug)` from `articles.js`
2. **`sanitizeArticleContent()`** → Async DOMPurify to sanitize HTML
3. **Error states**: Article not found, unable to load

### 🌐 **Navbar** (`src/components/Navbar.js`)
**Purpose**: Global navigation, authentication, search, theme switching
**Features**:
- User session check on mount
- Auth state listener (real-time updates)
- **`handleLogin()`** → OAuth via Google (`supabase.auth.signInWithOAuth`)
- **`handleLogout()`** → Sign out
- **`handleSearchSubmit()`** → Redirect to `/articles?search=query`
- **Theme switcher**: 4 themes (white/teal/violet/dark) stored in localStorage

### 📤 **EmailNotifyAPI** (`src/pages/api/notify.js`)
**Purpose**: Send email notification when new article drafted
**Handler**:
- **Method**: POST only
- **Payload**: `{ articleTitle, authorName, authorEmail }`
- **Validation**: All fields required, non-empty
- **Action**: 
  - Check `RESEND_API_KEY` env var
  - Call `resend.emails.send()` with HTML template
  - From: `Lahazaat <onboarding@resend.dev>`
  - To: `mustafa.rajkotwala12@gmail.com` (hardcoded)
  - Subject: "New Article Draft Submitted"
  - Body: Article title, author, email + link to admin dashboard

---

## API Endpoints Reference

| Route | Method | Purpose | Auth | Payload | Response |
|-------|--------|---------|------|---------|----------|
| `/api/notify` | POST | Send draft notification email | None | `articleTitle`, `authorName`, `authorEmail` | `{ success, error }` |

---

## Supabase Database Schema

### **ARTICLES** (Main content table)
```sql
id              :: UUID PRIMARY KEY
slug            :: TEXT UNIQUE (URL identifier)
title           :: TEXT
excerpt         :: TEXT (200 char preview)
content         :: TEXT (HTML from React Quill)
image_url       :: TEXT (Unsplash CDN)
author          :: TEXT (email or name)
author_id       :: UUID FK → auth.users (on delete set null)
category_id     :: UUID FK → categories (on delete set null)
is_published    :: BOOLEAN (false=draft, true=published)
created_at      :: TIMESTAMPTZ
updated_at      :: TIMESTAMPTZ
```
**Indexes**: `(created_at DESC)` WHERE `is_published=true`
**RLS Policies**:
- `articles_read_published`: Anyone can read `is_published=true`
- `articles_read_own_drafts`: Authors can read their own drafts
- `articles_insert_authenticated`: Authenticated users can create drafts
- `articles_update_own_drafts`: Authors can edit their own drafts
- `articles_admin_full`: Admins have full access

### **CATEGORIES**
```sql
id         :: UUID PRIMARY KEY
name       :: TEXT UNIQUE
created_at :: TIMESTAMPTZ
```
**RLS Policies**:
- `categories_select_all`: Public read
- `categories_admin_write`: Admins only can write

### **GAME_STATS** (Wordle statistics)
```sql
user_id            :: UUID FK → auth.users (on delete cascade) [PK]
game_type          :: TEXT [PK] (e.g., "wordle")
game_name          :: TEXT (display name)
last_played_date   :: DATE
last_result        :: TEXT (enum: 'won' | 'lost' | null)
current_streak     :: INTEGER (0-based)
max_streak         :: INTEGER (lifetime max)
wins               :: INTEGER
losses             :: INTEGER
games_played       :: INTEGER
last_guess_count   :: INTEGER (1-6)
created_at         :: TIMESTAMPTZ
updated_at         :: TIMESTAMPTZ
```
**Constraint**: Primary key = `(user_id, game_type)`
**RLS Policies**:
- Users can only read/write their own stats

### **DAILY_WORDS** (Wordle solution words)
```sql
id              :: UUID PRIMARY KEY
play_date       :: DATE UNIQUE
solution_word   :: TEXT (5 lowercase letters, CHECK constraint)
created_at      :: TIMESTAMPTZ
```
**RLS Policies**: Public read

### **PROFILES** (User metadata)
```sql
id              :: UUID PRIMARY KEY → auth.users (on delete cascade)
full_name       :: TEXT
avatar_url      :: TEXT
is_admin        :: BOOLEAN (false by default)
created_at      :: TIMESTAMPTZ
updated_at      :: TIMESTAMPTZ
```
**Trigger**: `on_auth_user_created` auto-syncs new auth users to profiles
**Admin Logic**: Email `mustafa.rajkotwala12@gmail.com` is hardcoded as admin
**RLS Policies**:
- `profiles_select_all`: Public read
- `profiles_update_own`: Users can edit their own profile
- `profiles_update_admin`: Admins can update any profile

---

## External Services & API Keys

| Service | Purpose | Key | Usage |
|---------|---------|-----|-------|
| **Supabase** | Database + Auth | `NEXT_PUBLIC_SUPABASE_URL` | http://127.0.0.1:54321 (local) |
| **Supabase Anon Key** | Client-side Supabase access | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` |
| **Google OAuth** | Social login | Supabase provider | `/edit` in Navbar invokes Google login |
| **Resend** | Email delivery | `RESEND_API_KEY` (server-only) | `re_RqdjBXbP_PbTLYDKpegfurH38VC138bNG` |
| **Unsplash** | Image CDN | Remote pattern | `images.unsplash.com/**` (Image optimization) |

---

## Environment Variables & Secrets

| Variable | Type | Scope | Usage | Recommendation |
|----------|------|-------|-------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL | Public | Frontend: Supabase connection endpoint | Can be public 🟢 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | String | Public | Frontend: Supabase anonymous key (RLS-protected) | Can be public (RLS enforced) 🟢 |
| `RESEND_API_KEY` | Secret | Private | Server-side only: Email API authentication | **MUST be secret** 🔴 Regenerate immediately |

**Security Notes**:
- `RESEND_API_KEY` is server-only and should never be exposed to frontend
- Supabase RLS policies enforce row-level security even with public keys
- Admin email is hardcoded in migrations (`mustafa.rajkotwala12@gmail.com`)

---

## Dependencies Summary

### Core Framework
- `next@16.2.1` — React framework
- `react@19.2.4`, `react-dom@19.2.4` — UI library

### Styling & UI
- `@tailwindcss/postcss@4` — Utility CSS framework
- `tailwindcss@4.2.2` — CSS processor
- `postcss` — CSS polyfill

### Backend & Database
- `@supabase/supabase-js@2.100.0` — Database + Auth client
- `supabase@2.84.4` — CLI for local development

### Features
- `react-quill@2.0.0` — Rich text editor
- `dompurify@3.3.3` — HTML sanitization
- `resend@6.9.4` — Email service

### Development
- `babel-plugin-react-compiler@1.0.0` — React compiler plugin
- `eslint@9.39.4` — Code linting
- `typescript@6.0.2` — Type support
- `@playwright/test@1.58.2` — E2E testing

---

## Component Hierarchy

```
_app.js (Global layout)
├── Navbar
│   ├── Logo link → index
│   ├── Nav links (Home, Articles, Games)
│   ├── Search form
│   ├── Theme switcher (4 themes)
│   └── Auth buttons (Login/Logout)
├── Main content (page-specific)
│   ├── HomePage / ArticlesPage / GamesPage / etc.
│   └── Nested components
└── Footer

HomePage / ArticlesPage
└── NewsCard (grid, reusable)

WordlePage
├── WordleGrid (6 rows)
├── WordleKeyboard
└── Game stats display

SubmitPage / AdminPage
└── ClientRichTextEditor (dynamic import)

ArticlePage
└── Sanitized HTML content
```

---

## Key Data Flow Processes

### 1️⃣ **Article Creation Workflow**
```
User (authenticated) 
  → SubmitPage 
  → Form validation 
  → Supabase INSERT (draft) 
  → /api/notify 
  → Resend email 
  → Admin notified
```

### 2️⃣ **Article Publishing**
```
Admin 
  → AdminPage 
  → Load drafts 
  → Edit in RTEditor 
  → Update Supabase 
  → Mark published 
  → Article visible on feed
```

### 3️⃣ **Article Viewing**
```
User 
  → HomePage/ArticlesPage 
  → Fetch published articles 
  → Display grid 
  → Click card 
  → [slug] page 
  → Sanitize HTML 
  → Render
```

### 4️⃣ **Wordle Game**
```
User 
  → WordlePage 
  → Load daily solution 
  → Enter guesses 
  → Validate against word list 
  → Evaluate 
  → Update UI 
  → Persist stats (if logged in) 
  → Lock on game end
```

### 5️⃣ **Authentication**
```
User clicks login 
  → Google OAuth redirect 
  → Supabase handles flow 
  → Profile auto-created via trigger 
  → User session stored
```

---

## Summary Statistics

- **Pages**: 8 (index, articles, games, games/wordle, news/[slug], submit, admin)
- **Components**: 6 (Navbar, Footer, NewsCard, WordleGrid, WordleKeyboard, ClientRichTextEditor)
- **Library functions**: 3 (supabase.js, articles.js, validWords.js)
- **API routes**: 1 (/api/notify)
- **Database tables**: 6 (articles, categories, game_stats, daily_words, profiles, auth.users)
- **External services**: 4 (Supabase, Google OAuth, Resend, Unsplash)
- **NPM dependencies**: 10 production + 9 dev

---

**Generated**: 2026-04-22  
**App Version**: 0.1.0
