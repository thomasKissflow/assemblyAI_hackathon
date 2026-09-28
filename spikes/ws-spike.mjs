const K = process.env.AAI_KEY;
const URL_BASE = 'wss://agents.assemblyai.com/v1/ws';

function probe(label, url) {
  return new Promise(resolve => {
    const events = [];
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return resolve({ label, error: String(e) }); }
    const done = (why) => { try { ws.close(); } catch {} ; resolve({ label, why, events }); };
    const t = setTimeout(() => done('timeout'), 8000);
    ws.onopen = () => {
      events.push('open');
      ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are a test agent. Keep replies to one short sentence.', greeting: 'Hi.' } }));
    };
    ws.onmessage = (m) => {
      let d; try { d = JSON.parse(m.data); } catch { d = { raw: String(m.data).slice(0, 80) }; }
      const summary = d.type + (d.error ? ` err=${JSON.stringify(d.error).slice(0,200)}` : '') + (d.message ? ` msg=${String(d.message).slice(0,200)}` : '');
      events.push(summary);
      if (events.length > 6 || /session\.(updated|error)/.test(d.type || '')) { clearTimeout(t); done('got-session-event'); }
    };
    ws.onerror = (e) => events.push('error:' + (e.message || 'ws error'));
    ws.onclose = (e) => { events.push(`close:${e.code}:${e.reason}`); clearTimeout(t); resolve({ label, why: 'closed', events }); };
  });
}

const tokRes = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=60', { headers: { Authorization: `Bearer ${K}` } });
const { token } = await tokRes.json();

for (const [label, url] of [
  ['minted-token', `${URL_BASE}?token=${encodeURIComponent(token)}`],
  ['raw-api-key-as-token', `${URL_BASE}?token=${K}`],
]) {
  console.log(JSON.stringify(await probe(label, url)));
}
process.exit(0);
