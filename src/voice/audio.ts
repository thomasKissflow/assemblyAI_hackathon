import { ChunkAccumulator, base64ToFloat } from './pcm';

export const SAMPLE_RATE = 24000;
const CHUNK_SAMPLES = SAMPLE_RATE / 20;

function rms(analyser: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly outAnalyser: AnalyserNode;
  private readonly micAnalyser: AnalyserNode;
  private readonly scratch = new Float32Array(1024);
  private readonly acc = new ChunkAccumulator(CHUNK_SAMPLES);
  private readonly sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private nextPlay = 0;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.out = this.ctx.createGain();
    this.outAnalyser = this.ctx.createAnalyser();
    this.outAnalyser.fftSize = 1024;
    this.out.connect(this.outAnalyser).connect(this.ctx.destination);
    this.micAnalyser = this.ctx.createAnalyser();
    this.micAnalyser.fftSize = 1024;
  }

  async startMic(onChunk: (chunk: Int16Array) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    await this.ctx.audioWorklet.addModule('/pcm-capture-worklet.js');
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
    const silent = this.ctx.createGain();
    silent.gain.value = 0;
    source.connect(this.micAnalyser);
    source.connect(this.node);
    this.node.connect(silent).connect(this.ctx.destination);
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      for (const chunk of this.acc.push(e.data)) onChunk(chunk);
    };
    await this.ctx.resume();
  }

  play(b64: string): number {
    const samples = base64ToFloat(b64);
    const at = Math.max(this.ctx.currentTime + 0.02, this.nextPlay);
    if (!samples.length) return at;
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.out);
    src.start(at);
    this.nextPlay = at + buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
    return at;
  }

  flush() {
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    this.sources.clear();
    this.nextPlay = 0;
  }

  get speaking() {
    return this.sources.size > 0;
  }

  get currentTime() {
    return this.ctx.currentTime;
  }

  levels(): { mic: number; out: number } {
    return { mic: rms(this.micAnalyser, this.scratch), out: rms(this.outAnalyser, this.scratch) };
  }

  async close() {
    this.flush();
    this.node?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    if (this.ctx.state !== 'closed') await this.ctx.close();
  }
}
