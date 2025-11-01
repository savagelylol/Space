// api/index.js

const express = require("express");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const { URL } = require("url");

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: "1mb" }));

const ADMIN_PASSWORD      = process.env.ADMIN_PASSWORD      || "";
const OPENROUTER_API_KEY  = process.env.OPENROUTER_API_KEY  || "";
const FRONTEND_ORIGIN     = process.env.FRONTEND_ORIGIN     || "*";

console.log("⚙️ API starting with config:", {
  ADMIN_PASSWORD_set: !!ADMIN_PASSWORD,
  OPENROUTER_API_KEY_set: !!OPENROUTER_API_KEY,
  FRONTEND_ORIGIN
});

// In-memory state
const bannedIPs           = new Set();
const pluginApprovalQueue = [];

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 1000,  // 15 seconds
  max:     20           // 20 requests per window per IP
}));

// CORS / pre-flight support
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

function isHtml(headers) {
  const ct = headers.get("content-type") || "";
  return ct.includes("text/html");
}

function proxifyAbsoluteLinks(html, origin) {
  const replacer = (match, p1) => {
    try {
      const target = new URL(p1);
      const prox   = `/proxy?url=${encodeURIComponent(target.toString())}`;
      return match.replace(p1, prox);
    } catch (_e) {
      return match;
    }
  };
  html = html.replace(/href\s*=\s*"((?:https?:)?\/\/[^"]+)"/g, replacer);
  html = html.replace(/src\s*=\s*"((?:https?:)?\/\/[^"]+)"/g, replacer);
  html = html.replace(/url\(\s*["']?((?:https?:)?\/\/[^"')]+)["']?\s*\)/g, (m, u) => {
    try {
      const prox = `/proxy?url=${encodeURIComponent(new URL(u).toString())}`;
      return `url("${prox}")`;
    } catch (_e) {
      return m;
    }
  });

  if (!html.includes("<base")) {
    const baseTag = `<base href="${origin}">`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${baseTag}`);
  }
  return html;
}

function injectDisguise(html, disguise) {
  const titleScript   = disguise?.title   ? `document.title = ${JSON.stringify(disguise.title)};` : "";
  const faviconScript = disguise?.favicon ? `
(function(){
  var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = "image/x-icon";
  link.rel  = "shortcut icon";
  link.href = ${JSON.stringify(disguise.favicon)};
  document.getElementsByTagName('head')[0].appendChild(link);
})();
` : "";
  const injection = `<script>/* injected by space proxy */\n${titleScript}\n${faviconScript}\n</script>\n`;
  return html.replace(/<\/head>/i, `${injection}</head>`);
}

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("✅ /health called");
  res.json({ ok: true });
});

// Proxy endpoint
app.get("/proxy", async (req, res) => {
  console.log("🔍 /proxy called with query:", req.query);
  const requesterIP = req.ip;
  if (bannedIPs.has(requesterIP)) {
    return res.status(403).send("Forbidden: banned IP");
  }

  const target = req.query.url;
  if (!target) {
    return res.status(400).send("Missing url param");
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch (e) {
    return res.status(400).send("Invalid URL");
  }

  const disguise = {};
  if (req.query.title)   disguise.title   = req.query.title;
  if (req.query.favicon) disguise.favicon = req.query.favicon;

  const disallowedHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
  if (disallowedHosts.includes(targetUrl.hostname)) {
    return res.status(403).send("Forbidden host");
  }

  try {
    const fetchResp = await fetch(targetUrl.toString(), {
      headers: { "user-agent": req.headers["user-agent"] || "Space-Proxy/1.0" },
      redirect: "follow"
    });

    const status = fetchResp.status;
    res.status(status);
    ["content-length", "content-type", "accept-ranges", "last-modified", "etag"].forEach(h => {
      const v = fetchResp.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    if (isHtml(fetchResp.headers)) {
      let body = await fetchResp.text();
      body = proxifyAbsoluteLinks(body, `${targetUrl.protocol}//${targetUrl.host}`);
      body = injectDisguise(body, disguise);
      const navGuard = `<script>
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (/^https?:\\/\\//i.test(href)){
      e.preventDefault();
      location.href = '/proxy?url=' + encodeURIComponent(href) + '&title=' + encodeURIComponent(document.title);
    }
  }, true);
})();
</script></body>`;
      body = body.replace(/<\/body>/i, navGuard);
      return res.send(body);
    } else {
      const arrayBuf = await fetchResp.arrayBuffer();
      return res.send(Buffer.from(arrayBuf));
    }
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res.status(500).send("Proxy error");
  }
});

// AI / Chat endpoint with OpenRouter
app.post("/ai", async (req, res) => {
  console.log("🤖 /ai called with messages length:", req.body.messages?.length);
  if (!OPENROUTER_API_KEY) {
    return res.status(501).json({ error: "AI backend not configured" });
  }
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid 'messages'" });
  }

  try {
    const apiUrl      = "https://openrouter.ai/api/v1/chat/completions";
    const bodyPayload = {
      model:        "openai/gpt-oss-20b:free",
      messages,
      max_tokens:   800,
      temperature:   0.7
    };

    const response = await fetch(apiUrl, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("❗ OpenRouter API returned error:", { status: response.status, data });
      return res.status(response.status).json({ error: "OpenRouter API error", details: data });
    }

    return res.json(data);
  } catch (err) {
    console.error("❌ OpenRouter request failed:", err);
    return res.status(500).json({ error: "AI request failed", details: err.message });
  }
});

// Admin endpoints
function requireAdmin(req, res, next) {
  const pw = req.headers["x-admin-password"] || req.query.admin_password;
  if (!pw || pw !== ADMIN_PASSWORD) {
    console.warn("⚠️ Unauthorized admin attempt from IP:", req.ip);
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/admin/ban", requireAdmin, (req, res) => {
  console.log("🚫 /admin/ban called", req.body);
  const ip = req.body.ip;
  if (!ip) return res.status(400).json({ error: "Missing ip" });
  bannedIPs.add(ip);
  return res.json({ ok: true, banned: ip });
});

app.post("/admin/unban", requireAdmin, (req, res) => {
  console.log("✅ /admin/unban called", req.body);
  const ip = req.body.ip;
  if (!ip) return res.status(400).json({ error: "Missing ip" });
  bannedIPs.delete(ip);
  return res.json({ ok: true, unbanned: ip });
});

app.get("/admin/plugins/queue", requireAdmin, (req, res) => {
  console.log("📋 /admin/plugins/queue called");
  return res.json({ queue: pluginApprovalQueue });
});

app.post("/admin/plugins/approve", requireAdmin, (req, res) => {
  console.log("✅ /admin/plugins/approve called", req.body);
  const name = req.body.name;
  const idx  = pluginApprovalQueue.findIndex(m => m.name === name);
  if (idx === -1) {
    return res.status(404).json({ error: "Plugin not found" });
  }
  const manifest = pluginApprovalQueue.splice(idx, 1)[0];
  manifest.approved = true;
  return res.json({ ok: true, approved: manifest });
});

// Export for Vercel serverless
module.exports = app;
