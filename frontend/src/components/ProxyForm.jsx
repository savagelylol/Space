// frontend/src/components/ProxyForm.jsx

import React, { useState } from "react";

export default function ProxyForm() {
  const [url, setUrl] = useState("");
  const [disguise, setDisguise] = useState("none");

  const templates = {
    none: { title: "", favicon: "" },
    "google-docs": { title: "My Document — Google Docs", favicon: "https://www.google.com/favicon.ico" },
    "youtube": { title: "YouTube", favicon: "https://s.ytimg.com/yts/img/favicon-vfl8qSV2F.ico" },
    "gmail": { title: "Inbox", favicon: "https://mail.google.com/favicon.ico" }
  };

  function goProxy(e) {
    e.preventDefault();
    if (!url) return alert("Enter a URL");
    const t = templates[disguise] || {};
    const proxyBase = (import.meta.env.PUBLIC_BACKEND_URL || "http://localhost:8080") + "/proxy";
    const q = new URL(proxyBase, window.location.href);
    q.searchParams.set("url", url);
    if (t.title) q.searchParams.set("title", t.title);
    if (t.favicon) q.searchParams.set("favicon", t.favicon);
    window.open(q.toString(), "_blank");
  }

  return (
    <form onSubmit={goProxy} className="bg-slate-900 p-6 rounded-xl shadow-lg">
      <label className="block text-sky-300">URL to proxy</label>
      <input
        className="w-full mt-2 p-3 rounded bg-black text-sky-100"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com"
      />
      <label className="block mt-4 text-sky-300">Tab disguise</label>
      <select className="mt-2 p-2 bg-black text-sky-100 rounded" value={disguise} onChange={e => setDisguise(e.target.value)}>
        <option value="none">None</option>
        <option value="google-docs">Google Docs (title + favicon)</option>
        <option value="youtube">YouTube</option>
        <option value="gmail">Gmail</option>
      </select>
      <div className="mt-4">
        <button className="px-4 py-2 rounded bg-sky-600">Open proxied page</button>
      </div>
    </form>
  );
}
