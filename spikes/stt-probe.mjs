import { readFileSync } from 'node:fs';
const K = process.env.AAI_KEY; const RATE = 16000, CH_MS = 50, CH = RATE*2*CH_MS/1000;
const DIR = new URL('./audio/', import.meta.url).pathname;
function pcm(n){const b=readFileSync(DIR+n+'.wav');let o=12;while(o<b.length){const id=b.toString('ascii',o,o+4),s=b.readUInt32LE(o+4);if(id==='data')return b.subarray(o+8,o+8+s);o+=8+s+(s%2);}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const model = process.argv[2] || 'universal-streaming-english';
const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&encoding=pcm_s16le&format_turns=false&speech_model=${model}&keyterms_prompt=${encodeURIComponent(JSON.stringify(['cheese','slice']))}&token=${K}`;
const ws = new WebSocket(url); ws.binaryType='arraybuffer';
let t0=null; const now=()=>t0===null?-1:Date.now()-t0; let begun; const bp=new Promise(r=>begun=r);
ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.type==='Begin'){console.log('Begin',JSON.stringify(d).slice(0,160));begun();return;}
 if(d.type==='Turn') console.log(String(now()).padStart(6),'Turn eot='+d.end_of_turn, JSON.stringify(d.transcript || (d.words||[]).map(w=>w.text).join(' ')));
 else console.log(String(now()).padStart(6), JSON.stringify(d).slice(0,300));};
ws.onclose=e=>console.log('close',e.code,e.reason); ws.onerror=e=>console.log('error',e.message);
await Promise.race([bp, sleep(6000)]); if (ws.readyState!==1) process.exit(0);
t0=Date.now(); const s=Buffer.concat([pcm('clueA16'),pcm('clueB16'),Buffer.alloc(RATE*2*3)]);
for(let i=0;i<s.length;i+=CH){ws.send(s.subarray(i,i+CH));await sleep(CH_MS);}
ws.send(JSON.stringify({type:'Terminate'})); await sleep(1500); ws.close();
