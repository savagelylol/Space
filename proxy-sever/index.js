// proxy-server/index.js
const express = require("express");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const { URL } = require("url");

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "please-change-me";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*"; // when deploying set to actual origin

// small in-memory ban list and plugin approval queue (demo)
const bannedIPs = new Set();
const pluginApprovalQueue = []; // store plugin manifests for admin review

// rate limiting
const limiter = rateLimit({
  windowMs: 15 * 1000, // 15s
  max: 20, // limit each IP to 20 requests per windowMs
});
app.use(limiter);

// CORS (allow frontend)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

function isHtml(headers) {
  const ct = headers.get("content-type") || "";
  return ct.includes("text/html");
}

function proxifyAbsoluteLinks(html, origin) {
  // Replace absolute http(s) links in href/src with proxied links
  // (This is a naive rewrite and should be improved before production.)
  const replacer = (match, p1) => {
    try {
      const target = new URL(p1);
      const prox = `/proxy?url=${encodeURIComponent(target.toString())}`;
      return match.replace(p1, prox);
    } catch (e) {
      return match;
    }
  };

  // href="https://..."
  html = html.replace(/href\s*=\s*"((?:https?:)?\/\/[^"]+)"/g, replacer);
  // src="https://..."
  html = html.replace(/src\s*=\s*"((?:https?:)?\/\/[^"]+)"/g, replacer);
  // url("https://...") in css
  html = html.replace(/url\(\s*["']?((?:https?:)?\/\/[^"')]+)["']?\s*\)/g, (m, u) => {
    try {
      const prox = `/proxy?url=${encodeURIComponent(new URL(u).toString())}`;
      return `url("${prox}")`;
    } catch (e) {
      return m;
    }
  });

  // set <base href="..."> to preserve relative links
  if (!html.includes("<base")) {
    const baseTag = `<base href="${origin}">`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${baseTag}`);
  }

  return html;
}

function injectDisguise(html, disguise) {
  // disguise = { title, favicon } - both optional
  const titleScript = disguise?.title
    ? `document.title = ${JSON.stringify(disguise.title)};`
    : "";
  const faviconScript = disguise?.favicon
    ? `
(function(){
  var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/x-icon';
  link.rel = 'shortcut icon';
  link.href = ${JSON.stringify(disguise.favicon)};
  document.getElementsByTagName('head')[0].appendChild(link);
})();
`
    : "";

  const injection = `<script>/* injected by Space proxy */\n${titleScript}\n${faviconScript}\n</script>\n`;

  // inject before </head>
  return html.replace(/<\/head>/i, `${injection}</head>`);
}

app.get("/proxy", async (req, res) => {
  try {
    const requesterIP = req.ip;
    if (bannedIPs.has(requesterIP)) {
      return res.status(403).send("Forbidden");
    }

    const target = req.query.url;
    if (!target) return res.status(400).send("Missing url param");
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return res.status(400).send("Invalid URL");
    }

    // Optional disguise params
    const disguise = {};
    if (req.query.title) disguise.title = req.query.title;
    if (req.query.favicon) disguise.favicon = req.query.favicon;

    // Very small abuse mitigation: block requests to local addresses
    const disallowedHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
    if (disallowedHosts.includes(targetUrl.hostname)) {
      return res.status(403).send("Forbidden host");
    }

    // Fetch the target
    const fetchResp = await fetch(targetUrl.toString(), {
      headers: {
        "user-agent": req.headers["user-agent"] || "Space-Proxy/1.0",
        // avoid forwarding cookies by default, but you could if desired
        // "cookie": req.headers.cookie || ""
      },
      redirect: "follow",
    });

    // Forward status and headers (but not all headers)
    const contentType = fetchResp.headers.get("content-type") || "";
    res.status(fetchResp.status);
    // copy a subset of safe headers:
    ["content-length", "content-type", "accept-ranges", "last-modified", "etag"].forEach((h) => {
      const v = fetchResp.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    if (isHtml(fetchResp.headers)) {
      let body = await fetchResp.text();

      // 1) rewrite absolute links to route back through our proxy
      body = proxifyAbsoluteLinks(body, `${targetUrl.protocol}//${targetUrl.host}`);

      // 2) inject title & favicon override (tab disguising)
      body = injectDisguise(body, disguise);

      // 3) small JavaScript guard: re-route window.location navigations through proxy
      const navGuard = `<script>
(function(){
  // intercept link clicks to re-proxy via the server
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if(!a) return;
    var href = a.getAttribute('href');
    if(!href) return;
    // only do for absolute http(s) links
    if(/^https?:\\/\\//i.test(href)){
      e.preventDefault();
      location.href = '/proxy?url=' + encodeURIComponent(href) + '&title=' + encodeURIComponent(document.title);
    }
  }, true);
})();
</script></body>`;
      body = body.replace(/<\/body>/i, navGuard);

      return res.send(body);
    } else {
      // binary or other: stream it directly
      const buffer = await fetchResp.buffer();
      res.send(buffer);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error");
  }
});

// --- AI relay endpoint (simple wrapper for OpenAI Chat API) ---
app.post("/ai", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(501).send("AI backend not configured. Set OPENAI_API_KEY.");
  const { messages } = req.body;
  if (!messages) return res.status(400).send("Missing messages");

  try {
    // This example uses OpenAI's chat completions. You can swap to other providers.
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change to the model you have access to
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error("AI proxy error", e);
    res.status(500).send("AI error");
  }
});

// --- Admin endpoints (very minimal: protect by ADMIN_PASSWORD) ---
function requireAdmin(req, res, next) {
  const pw = req.headers["x-admin-password"] || req.query.admin_password;
  if (!pw || pw !== ADMIN_PASSWORD) return res.status(401).send("Unauthorized");
  next();
}

app.post("/admin/ban", requireAdmin, (req, res) => {
  const ip = req.body.ip;
  if (!ip) return res.status(400).send("Missing ip");
  bannedIPs.add(ip);
  res.json({ ok: true, banned: ip });
});

app.post("/admin/unban", requireAdmin, (req, res) => {
  const ip = req.body.ip;
  if (!ip) return res.status(400).send("Missing ip");
  bannedIPs.delete(ip);
  res.json({ ok: true, unbanned: ip });
});

// Add plugin submission endpoint (demo)
app.post("/plugins/submit", (req, res) => {
  // plugin payload should include manifest + code url
  const manifest = req.body.manifest;
  if (!manifest || !manifest.name || !manifest.entry) return res.status(400).send("Bad manifest");
  manifest.submittedAt = new Date().toISOString();
  manifest.approved = false;
  pluginApprovalQueue.push(manifest);
  res.json({ ok: true, queued: manifest.name });
});

app.get("/admin/plugins/queue", requireAdmin, (req, res) => {
  res.json({ queue: pluginApprovalQueue });
});

app.post("/admin/plugins/approve", requireAdmin, (req, res) => {
  const name = req.body.name;
  const idx = pluginApprovalQueue.findIndex((m) => m.name === name);
  if (idx === -1) return res.status(404).send("Not found");
  const manifest = pluginApprovalQueue.splice(idx, 1)[0];
  manifest.approved = true;
  // In a real system you'd persist to DB and publish it to the marketplace
  res.json({ ok: true, approved: manifest });
});

app.listen(PORT, () => {
  console.log(`Space proxy running on port ${PORT}`);
});
