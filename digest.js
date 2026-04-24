// =============================================================
// OPERATOR INTELLIGENCE DIGEST
// Weekly Monday 8am IST → Email + local digest folder
// Twitter primary, RSS fallback
// =============================================================

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// ─── OPERATORS ────────────────────────────────────────────────
// 6 curated operators, rotating weekly focus
// Twitter = primary signal | rss = fallback for blog-heavy ones
const OPERATORS = [
  {
    name: "Pieter Levels",
    handle: "levelsio",
    primary: "twitter",
    rss: "https://levels.io/rss/",
    why: "Revenue-transparent solo SaaS. Real-time build decisions.",
  },
  {
    name: "Marc Lou",
    handle: "marc_louvion",
    primary: "twitter",
    rss: "https://marclou.beehiiv.com/feed",
    why: "Extreme launch velocity. Filters ruthlessly on what to build.",
  },
  {
    name: "Tony Dinh",
    handle: "tdinh_me",
    primary: "twitter",
    rss: "https://news.tonydinh.com/feed",
    why: "Monthly public revenue reflections. Pricing and model experiments.",
  },
  {
    name: "Simon Willison",
    handle: "simonw",
    primary: "rss", // blog-heavy operator, RSS is richer
    rss: "https://simonwillison.net/atom/everything/",
    why: "First-principles LLM evaluations. Coins the concepts everyone else copies.",
  },
  {
    name: "Dan Shipper",
    handle: "danshipper",
    primary: "rss", // Every.to essays are the signal
    rss: "https://every.to/chain-of-thought/feed",
    why: "AI-native company operator. 5 products, 15 people, 7-fig revenue.",
  },
  {
    name: "Greg Isenberg",
    handle: "gregisenberg",
    primary: "twitter",
    rss: "https://latecheckout.substack.com/feed",
    why: "Distills operator playbooks. Best at problem-spotting frameworks.",
  },
];

// ─── HELPERS ──────────────────────────────────────────────────

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const originalUrl = url;
    const originalUrlObj = new URL(url);
    let redirectCount = 0;

    function resolveLocation(location, baseUrl) {
      if (!location) return baseUrl;
      const trimmed = location.trim();
      try {
        return new URL(trimmed, baseUrl).toString();
      } catch {
        try {
          return new URL(trimmed, originalUrl).toString();
        } catch {
          if (trimmed.startsWith("//")) return `${originalUrlObj.protocol}${trimmed}`;
          if (trimmed.startsWith("/")) return `${originalUrlObj.origin}${trimmed}`;
          if (!trimmed.includes("://")) return `${originalUrlObj.protocol}//${trimmed}`;
          return trimmed;
        }
      }
    }

    function doFetch(currentUrl) {
      try {
        currentUrl = new URL(currentUrl, originalUrl).toString();
      } catch {
        // If URL resolution fails, try to use the last valid base URL as a fallback
        try {
          currentUrl = new URL(currentUrl, url).toString();
        } catch {
          // leave currentUrl unchanged and let http.get reject if invalid
        }
      }
      const lib2 = currentUrl.startsWith("https") ? https : http;
      lib2
        .get(currentUrl, { headers: { "User-Agent": "OperatorDigest/1.0" } }, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectCount < 5) {
            redirectCount++;
            const nextUrl = resolveLocation(res.headers.location, currentUrl);
            doFetch(nextUrl);
            return;
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        })
        .on("error", reject);
    }

    doFetch(url);
  });
}

function isLastWeek(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo && date <= now;
}

function parseRssItems(xml) {
  const items = [];
  // Match both <item> (RSS) and <entry> (Atom)
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || "";
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) ||
      block.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    const pubDate =
      (block.match(/<pubDate>(.*?)<\/pubDate>/) ||
        block.match(/<published>(.*?)<\/published>/) ||
        block.match(/<updated>(.*?)<\/updated>/) || [])[1] || "";
    const desc =
      (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ||
        block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) ||
        block.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/) || [])[1] || "";
    // Strip HTML tags
    const text = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
    items.push({ title: title.trim(), link: link.trim(), pubDate, text });
  }
  return items;
}

// ─── DATA FETCHERS ────────────────────────────────────────────

async function fetchTwitter(handle) {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) return [];
  try {
    const url = `https://api.twitterapi.io/twitter/user/tweets?username=${handle}&limit=20`;
    const data = await fetchJson(url, {
      headers: { "x-api-key": key },
      hostname: "api.twitterapi.io",
      path: `/twitter/user/tweets?username=${handle}&limit=20`,
      method: "GET",
    });
    const tweets = Array.isArray(data.tweets)
      ? data.tweets
      : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.data?.tweets)
      ? data.data.tweets
      : [];
    if (!Array.isArray(tweets)) {
      console.error(`Twitter fetch unexpected response for ${handle}:`, JSON.stringify(data).slice(0, 200));
      return [];
    }
    return tweets
      .filter((t) => isLastWeek(t.created_at || t.createdAt))
      .map((t) => ({
        title: "",
        text: t.text || t.full_text || "",
        link: `https://x.com/${handle}/status/${t.id || t.id_str}`,
        pubDate: t.created_at || t.createdAt,
        source: "twitter",
      }));
  } catch (e) {
    console.error(`Twitter fetch failed for ${handle}:`, e.message);
    return [];
  }
}

async function fetchRSS(operator) {
  if (!operator.rss) return [];
  try {
    const xml = await fetchText(operator.rss);
    const items = parseRssItems(xml);
    return items
      .filter((i) => isLastWeek(i.pubDate))
      .map((i) => ({ ...i, source: "rss" }));
  } catch (e) {
    console.error(`RSS fetch failed for ${operator.name}:`, e.message);
    return [];
  }
}

async function gatherOperatorContent(operator) {
  let items = [];

  if (operator.primary === "twitter") {
    items = await fetchTwitter(operator.handle);
    // Fallback to RSS if Twitter yields nothing
    if (items.length === 0) {
      console.log(`  Twitter empty for ${operator.name}, falling back to RSS`);
      items = await fetchRSS(operator);
    }
  } else {
    items = await fetchRSS(operator);
    // Supplement with Twitter if RSS is thin
    if (items.length < 2) {
      const tweets = await fetchTwitter(operator.handle);
      items = [...items, ...tweets];
    }
  }

  return { operator, items };
}

// ─── CLAUDE SYNTHESIS ─────────────────────────────────────────

async function synthesizeWithClaude(operatorData) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // Build context block per operator
  const contextBlocks = operatorData
    .filter((d) => d.items.length > 0)
    .map(({ operator, items }) => {
      const content = items
        .slice(0, 8) // cap at 8 items per operator to control tokens
        .map((i) => `[${i.source}] ${i.title ? i.title + ": " : ""}${i.text} ${i.link}`)
        .join("\n\n");
      return `## ${operator.name} (@${operator.handle})\nWhy track: ${operator.why}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  if (!contextBlocks.trim()) {
    return "No new content found this week from tracked operators. Check RSS feeds and Twitter API key.";
  }

  const systemPrompt = `You are an operator intelligence analyst helping an aspiring founder build operator muscle memory.

Your job: from this week's activity across 6 top AI-native builders, pick the SINGLE most instructive build/project/insight and write a tight digest.

Format your response EXACTLY like this:

🎯 THIS WEEK'S OPERATOR PICK
[Operator Name] — @[handle]

💡 THE PROBLEM THEY SAW
[2-3 sentences. What gap, pain, or opportunity did they identify? Be specific.]

🔨 WHAT THEY BUILT
[2-3 sentences. What exactly did they ship or experiment with?]

🧠 WHY THEY BUILT IT (their reasoning)
[2-3 sentences. What was their mental model or decision framework? Quote their own words if available.]

⚙️ HOW THEY BUILT IT
[Tools, stack, AI models used, time taken. Be concrete.]

🔁 THE FRAMEWORK TO STEAL
[1-2 sentences. The transferable decision pattern — not the product, but the thinking.]

❓ YOUR BUILD QUESTION
[One specific question for the reader to answer about their own context. Make it concrete and actionable — e.g. "Where in your daily work do you hit [X problem] that you've been ignoring?"]

---

Rules:
- Pick only ONE operator/project (the most instructive)
- Prefer content that shows decision-making process over finished products
- If someone shipped something with a specific AI tool or workflow, name it exactly
- Keep total length under 400 words
- No fluff, no "great to see", no filler sentences`;

  const body = JSON.stringify({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Here is this week's activity from 6 AI-native operators. Select the single most instructive build and synthesize it per the format.\n\n${contextBlocks}`,
      },
    ],
  });

  const data = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch { reject(new Error("Claude response parse failed: " + d)); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  if (data.error) throw new Error("Claude API error: " + JSON.stringify(data.error));
  return data.content?.[0]?.text || "Claude returned empty response";
}

// ─── EMAIL DELIVERY + LOCAL SAVE ──────────────────────────────

function saveDigestToFile(text) {
  const outputDir = process.env.DIGEST_OUTPUT_DIR || path.join(__dirname, "digests");
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `digest-${new Date().toISOString().slice(0, 10)}.md`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, text, "utf8");
  return filePath;
}

async function sendEmail(text, subject) {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = Number(process.env.EMAIL_SMTP_PORT || 587);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;

  if (!host || !port || !user || !pass || !from || !to) {
    throw new Error(
      "Email credentials not set. Required: EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, EMAIL_FROM, EMAIL_TO"
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Fetching operator content...");

  // Fetch all operators in parallel
  const operatorData = await Promise.all(OPERATORS.map(gatherOperatorContent));

  const totalItems = operatorData.reduce((sum, d) => sum + d.items.length, 0);
  console.log(`📦 Found ${totalItems} items across ${OPERATORS.length} operators`);

  operatorData.forEach(({ operator, items }) => {
    console.log(`  ${operator.name}: ${items.length} items`);
  });

  console.log("🤖 Synthesizing with Claude...");
  const digest = await synthesizeWithClaude(operatorData);

  const header = `OPERATOR INTELLIGENCE — Week of ${new Date().toDateString()}\n\n`;
  const footer = `\n\nTrack → Think → Build.`;
  const fullMessage = header + digest + footer;

  const savedPath = saveDigestToFile(fullMessage);
  console.log(`💾 Saved digest to ${savedPath}`);

  console.log("📨 Sending digest by email...");
  await sendEmail(fullMessage, `Operator Digest — Week of ${new Date().toDateString()}`);

  console.log("✅ Done!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
