import React, { useState, useEffect, useRef } from "react";

export default function ChatWidget({ backendUrl = "http://localhost:8080" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem("space_chat_history");
      return raw ? JSON.parse(raw) : [{ role: "system", content: "You are Astro, a friendly space-themed assistant." }];
    } catch {
      return [{ role: "system", content: "You are Astro, a friendly space-themed assistant." }];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(()=> {
    localStorage.setItem("space_chat_history", JSON.stringify(messages));
  }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch(`${backendUrl}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await resp.json();
      // OpenAI response path (adapt if you use a different provider)
      const aiText = (data?.choices?.[0]?.message?.content) || data?.error?.message || "Sorry, no response";
      const next = [...newMessages, { role: "assistant", content: aiText }];
      setMessages(next);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Error: " + String(e) }]);
    } finally {
      setLoading(false);
      // auto-scroll
      setTimeout(()=> containerRef.current && (containerRef.current.scrollTop = containerRef.current.scrollHeight), 50);
    }
  }

  return (
    <>
      <div className={`fixed right-6 bottom-6 z-50 ${open ? "" : ""}`}>
        {open ? (
          <div className="w-80 md:w-96 bg-slate-900 text-sky-100 rounded-xl shadow-lg overflow-hidden">
            <div className="p-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">A</div>
                <div className="text-sm font-semibold">Astro</div>
              </div>
              <div>
                <button onClick={()=>setOpen(false)} className="text-sky-300">Close</button>
              </div>
            </div>

            <div ref={containerRef} className="p-3 max-h-64 overflow-auto space-y-3">
              {messages.filter(m=>m.role!=='system').map((m, i)=> (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <div className={`inline-block p-2 rounded ${m.role === "assistant" ? "bg-slate-800" : "bg-sky-700/20"}`}>
                    <div style={{whiteSpace: 'pre-wrap'}}>{m.content}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800">
              <textarea value={input} onChange={(e)=>setInput(e.target.value)} className="w-full p-2 rounded bg-black text-sky-100" rows="2" />
              <div className="flex justify-between mt-2">
                <button onClick={send} disabled={loading} className="px-3 py-1 rounded bg-sky-600">{loading ? "..." : "Send"}</button>
                <button onClick={()=>{ setMessages([{ role: 'system', content: messages[0]?.content || "You are Astro"}]); localStorage.removeItem('space_chat_history') }} className="text-sky-300">Clear</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={()=>setOpen(true)} className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg flex items-center justify-center">
            A
          </button>
        )}
      </div>
    </>
  );
}
