const ws = new WebSocket('wss://agents.assemblyai.com/v1/ws?token=00000000000000000000000000000000');
const ev = [];
const end = (w) => { console.log(JSON.stringify({ w, ev })); process.exit(0); };
ws.onopen = () => { ev.push('open'); ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'x' } })); };
ws.onmessage = (m) => { ev.push(String(m.data).slice(0, 200)); };
ws.onerror = (e) => ev.push('error');
ws.onclose = (e) => { ev.push(`close:${e.code}:${e.reason}`); end('closed'); };
setTimeout(() => end('timeout'), 8000);
