# Operator Intelligence Digest

Delivers a weekly Monday morning Telegram message with the single most instructive build from 6 top AI-native operators. Reverse-engineers their problem-spotting, decision framework, and tools.

## What it does

Every Monday at 8:00 AM IST:
1. Fetches last 7 days of content from 6 operators (Twitter primary, RSS fallback)
2. Claude picks the single most instructive build of the week
3. Synthesizes: problem → what they built → why → how → framework to steal
4. Delivers to your Telegram with one build question for you to answer

## Operators tracked

| Operator | Primary Source | Why |
|---|---|---|
| Pieter Levels (@levelsio) | Twitter | Revenue-transparent. Real-time build decisions |
| Marc Lou (@marc_louvion) | Twitter | Extreme launch velocity. Ruthless scoping |
| Tony Dinh (@tdinh_me) | Twitter | Monthly revenue reflections. Pricing experiments |
| Simon Willison (@simonw) | RSS (blog) | First-principles LLM evals. Coins the concepts |
| Dan Shipper (@danshipper) | RSS (Every.to) | AI-native company. 5 products, 15 people, 7-fig |
| Greg Isenberg (@gregisenberg) | Twitter | Problem-spotting frameworks. Operator playbooks |

## Setup (15 minutes)

### Step 1 — Fork / create the repo

Create a new GitHub repo (can be private). Add these two files:
- `digest.js` (root)
- `.github/workflows/digest.yml`

### Step 2 — Get your API keys

**Twitter data (~$1-2/month):**
1. Go to [twitterapi.io](https://twitterapi.io)
2. Sign up (free $0.10 starter credit)
3. Copy your API key

**Claude API (~$1-2/month):**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Add a few dollars of credit

**Telegram bot (free):**
1. Open Telegram → search `@BotFather`
2. Send `/newbot` → follow prompts → save the bot token
3. Send any message to your new bot
4. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
5. Find `"chat":{"id":XXXXXXX}` — that number is your Chat ID

### Step 3 — Add GitHub Secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

Add all four:

| Secret name | Value |
|---|---|
| `TWITTERAPI_IO_KEY` | Your twitterapi.io key |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | `123456789:ABCdef...` |
| `TELEGRAM_CHAT_ID` | Your numeric chat ID |

### Step 4 — Test it

Go to **Actions tab → Weekly Operator Digest → Run workflow** (manual trigger).

Watch the logs. You should receive a Telegram message within ~30 seconds.

### Step 5 — Done

Runs automatically every Monday at 8:00 AM IST. No maintenance required.

## Cost breakdown

| Component | Cost |
|---|---|
| GitHub Actions | Free |
| twitterapi.io | ~$1-2/month |
| Claude API (Sonnet) | ~$1-2/month |
| Telegram | Free |
| RSS feeds | Free |
| **Total** | **~$2-4/month** |

## Customise operators

Edit the `OPERATORS` array in `digest.js`. Each entry:

```js
{
  name: "Display Name",
  handle: "twitter_handle",       // without @
  primary: "twitter" | "rss",     // which source to try first
  rss: "https://...",             // RSS/Atom feed URL
  why: "Why you're tracking them" // feeds into Claude's context
}
```

**RSS URL patterns:**
- Substack: `https://{publication}.substack.com/feed`
- YouTube: `https://www.youtube.com/feeds/videos.xml?channel_id={ID}`
- Most blogs: `/feed`, `/rss`, `/atom.xml`

## How to use the digest

The digest ends with a **build question**. Answer it — even 2 sentences — in Telegram saved messages or a notes app. This is the forcing function that separates consumption from operator skill-building.

After 4 weeks of answering the build question, pick one answer and spend a weekend building a micro version of the insight you captured.
