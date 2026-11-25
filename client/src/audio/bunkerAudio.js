// bunkerAudio.js — Procedural Web Audio Engine for Fallout Vault-Tec Atmosphere

class BunkerAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.humNodes = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      // Start continuous ambient hum
      this.startAmbientHum();
      this.startGeigerRandomizer();
    } catch (e) {
      console.warn('[Audio] Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ─── 1. Continuous Generator & Ventilation Hum ───
  startAmbientHum() {
    if (!this.ctx) return;

    // Sub oscillator (55Hz generator rumble)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

    // Lowpass filter for deep muffled engine
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, this.ctx.currentTime);

    // Filtered pink noise for ventilation air whoosh
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    osc1.connect(filter);
    filter.connect(humGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(humGain);

    humGain.connect(this.masterGain);

    osc1.start();
    noiseSource.start();

    this.humNodes = { osc1, noiseSource, humGain };
  }

  // ─── 2. Random Geiger Counter Clicks ───
  startGeigerRandomizer() {
    const triggerClick = () => {
      if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
        if (Math.random() > 0.4) {
          this.playGeigerClick();
          if (Math.random() > 0.7) {
            setTimeout(() => this.playGeigerClick(), 40 + Math.random() * 60);
          }
        }
      }
      setTimeout(triggerClick, 300 + Math.random() * 1500);
    };
    setTimeout(triggerClick, 2000);
  }

  playGeigerClick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1200 + Math.random() * 800, now);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.04 + Math.random() * 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.01);
  }

  // ─── 3. Card Hover (Subtle paper swoosh) ───
  playCardHover() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // ─── 4. Card Slap on Metal Table ───
  playCardSlap() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic table thud (low pitch)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(140, now);
    thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

    thudGain.gain.setValueAtTime(0.25, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain);
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);

    // Card slap snap (high frequency burst)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sine';
    snapOsc.frequency.setValueAtTime(950, now);
    snapOsc.frequency.exponentialRampToValueAtTime(200, now + 0.06);

    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(now);
    snapOsc.stop(now + 0.08);
  }

  // ─── 5. Relay Mechanical Clack (Catastrophe Roulette) ───
  playRelayTick() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800 + Math.random() * 150, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  // ─── 6. Pip-Boy Confirmation Chime ───
  playPipBoySelect() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1320, now + 0.06); // E6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // ─── 6b. RobCo CRT Terminal Beep ───
  playTerminalBeep() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1760, now); // A6 high terminal CRT blip

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // ─── 7. Emergency Alarm (Ejection) ───
  playEjectionAlarm() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const startTime = now + i * 0.45;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, startTime);
      osc.frequency.linearRampToValueAtTime(780, startTime + 0.35);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    }
  }

  // ─── 8. Heavy Gear Door Clank / Opening ───
  playVaultDoorOpen() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy bass impact
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(90, now);
    boom.frequency.exponentialRampToValueAtTime(25, now + 0.8);

    boomGain.gain.setValueAtTime(0.4, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 1.0);

    // Metal friction screech
    const scrape = this.ctx.createOscillator();
    const scrapeGain = this.ctx.createGain();
    scrape.type = 'sawtooth';
    scrape.frequency.setValueAtTime(320, now + 0.1);
    scrape.frequency.linearRampToValueAtTime(180, now + 0.9);

    scrapeGain.gain.setValueAtTime(0.08, now + 0.1);
    scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    scrape.connect(scrapeGain);
    scrapeGain.connect(this.masterGain);
    scrape.start(now + 0.1);
    scrape.stop(now + 1.0);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const bunkerAudio = new BunkerAudioEngine();
