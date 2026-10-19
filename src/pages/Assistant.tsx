import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { GLOSSARY } from '../data/glossary';

interface Msg { role: 'user' | 'assistant'; text: string }

const TIPS: { keywords: string[]; answer: string }[] = [
  { keywords: ['chain', 'chain hit'], answer: 'A chain is a faction-wide sequence of hits — each member hit extends it within a time window. Use the War Room to track chain progress and the Dibs page to reserve hospital targets.' },
  { keywords: ['dibs'], answer: 'Dibs let you claim a hospital target for a set window (default 15 min) before they leave. Open the Dibs page, enter the target Torn ID and claim window.' },
  { keywords: ['fair fight', 'ff'], answer: 'Fair Fight (FF) scales respect based on the stat gap between you and your target. Check the Compare Players page to estimate FF before hitting.' },
  { keywords: ['spy'], answer: 'Spy reports reveal another player\'s battle stats. Log them on the Spy Reports page to build intel over time.' },
  { keywords: ['travel', 'flight'], answer: 'Use the Flight Tracker to log flights (destination, departure, arrival) and mark them in_flight/arrived/returned.' },
  { keywords: ['target pool'], answer: 'Target Pools let you save curated lists of targets (e.g. inactive chain targets). Create one on the Target Pools page with a name and comma-separated Torn IDs.' },
  { keywords: ['alert'], answer: 'Set up alerts on the Alerts page (e.g. target leaves hospital, chain drops below X). The evaluate-alerts cron job checks them every 5 minutes.' },
  { keywords: ['userscript', 'companion'], answer: 'Install the companion userscript from /torn-helper.user.js via Tampermonkey. It adds a floating panel on torn.com with quick links and a target lookup.' },
  { keywords: ['discord'], answer: 'Add a Discord webhook on the Discord page to broadcast messages (alerts, war updates) to your channel.' },
  { keywords: ['api key', 'link key'], answer: 'Link your Torn API key via the link-torn-key Edge Function. Keys are encrypted at rest with TORN_KEY_ENCRYPTION_KEY.' },
];

function answer(question: string): string {
  const q = question.toLowerCase();
  const tip = TIPS.find((t) => t.keywords.some((k) => q.includes(k)));
  if (tip) return tip.answer;
  const entry = GLOSSARY.find((g) => q.includes(g.term.toLowerCase()));
  if (entry) return `${entry.term} (${entry.category}): ${entry.definition}`;
  return 'I can help with Torn terms, app features (dibs, target pools, alerts, war room, flights, Discord), and mechanics. Try asking about "chain", "dibs", "fair fight", or "spy".';
}

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const q = input.trim();
    if (!q) return;
    const a = answer(q);
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: a }]);
    setInput('');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('assistant_logs').insert({ user_id: user.id, question: q, answer: a });
      if (error) setError(error.message);
    }
  }

  return (
    <section>
      <h2>Assistant</h2>
      <p className="muted">Ask about Torn terms, mechanics, or app features. Answers are keyword-matched from the built-in glossary and tips; conversations are logged owner-only.</p>
      {error && <p className="badge warn">{error}</p>}
      <article className="card nu-inset" style={{ maxHeight: 400, overflowY: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span className="badge">{m.role === 'user' ? 'You' : 'Assistant'}</span>
            <p style={{ margin: '4px 0' }}>{m.text}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="muted">Ask something like “What is a chain?” or “How do I set up dibs?”</p>}
        <div ref={bottomRef} />
      </article>
      <article className="card nu-inset">
        <input className="nu-input" placeholder="Ask the assistant…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="nu-btn" onClick={send}>Send</button>
      </article>
    </section>
  );
}
