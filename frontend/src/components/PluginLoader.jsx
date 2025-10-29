import React, { useState, useEffect } from "react";

export default function PluginLoader() {
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    // Fetch plugin manifests from /plugins folder
    fetch("/plugins/").then(async (resp) => {
      // naive: we expect a JSON listing (in production host plugin manifest list API)
      try {
        const list = await resp.json();
        setPlugins(list);
      } catch {
        // fallback: sample plugin
        setPlugins([
          {
            name: "Stellar Theme",
            slug: "stellar-theme",
            entry: "/plugins/sample-theme/plugin.js",
            description: "A space theme",
            approved: true
          }
        ]);
      }
    });
  }, []);

  function install(pl) {
    try {
      fetch(pl.entry).then(r => r.text()).then(code => {
        // sandbox: eval in scoped function
        // provide a host API if needed
        const pluginFunc = new Function("host", code + "\nreturn {};"); 
        pluginFunc(window.SpacePluginHost || {});
        alert("Plugin " + pl.name + " installed!");
      });
    } catch (e) {
      alert("Plugin install error: " + e.message);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {plugins.map((pl, i) => (
        <div key={i} className="p-4 bg-slate-900 rounded">
          <h3 className="text-xl">{pl.name}</h3>
          <p className="mt-1">{pl.description}</p>
          <button className="mt-2 px-3 py-1 bg-sky-600 rounded" onClick={()=>install(pl)}>Install</button>
        </div>
      ))}
    </div>
  );
}
