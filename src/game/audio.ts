// Audio Manager using Web Audio API for tactical gun sounds, impacts, reloads, and running footsteps
class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Custom audio buffers
  private gunshotBuffer: AudioBuffer | null = null;
  private reloadBuffer: AudioBuffer | null = null;
  private runningBuffer: AudioBuffer | null = null;
  private isBufferLoading: boolean = false;

  // Running audio
  private isRunningSoundPlaying: boolean = false;
  private currentRunningSource: AudioBufferSourceNode | null = null;
  private runningGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
    // Also trigger sound preload attempt if possible
    if (typeof window !== 'undefined') {
      this.loadAllCustomSounds();
    }
  }

  public initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);
      this.loadAllCustomSounds();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private async fetchAndDecode(urls: string[]): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
          return audioBuf;
        }
      } catch {
        // try next candidate
      }
    }
    return null;
  }

  private async loadAllCustomSounds() {
    if (this.isBufferLoading) return;
    this.isBufferLoading = true;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.6;
        this.masterGain.connect(this.ctx.destination);
      }

      // 1. M4A1 Gunshot
      if (!this.gunshotBuffer) {
        this.gunshotBuffer = await this.fetchAndDecode([
          encodeURI('/sounds/Free fire M4A1 Gun sound effect  M4A1 sound effect 2025.wav'),
          '/sounds/m4a1_shot.wav',
          encodeURI('/Sounds/Free fire M4A1 Gun sound effect  M4A1 sound effect 2025.wav'),
        ]);
      }

      // 2. Reload sound: ReloadSound.wav
      if (!this.reloadBuffer) {
        this.reloadBuffer = await this.fetchAndDecode([
          '/sounds/ReloadSound.wav',
          '/sounds/reload.wav',
          '/Sounds/ReloadSound.wav',
        ]);
      }

      // 3. Running sound: RunningSound.wav
      if (!this.runningBuffer) {
        this.runningBuffer = await this.fetchAndDecode([
          '/sounds/RunningSound.wav',
          '/sounds/running.wav',
          '/Sounds/RunningSound.wav',
        ]);
      }
    } catch (e) {
      console.warn('Could not decode custom sound files:', e);
    } finally {
      this.isBufferLoading = false;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.6;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // M4A1 Gunshot sound (Plays user custom WAV sound effect, with fallback to tactical synthesis)
  public playGunshot() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (!this.gunshotBuffer && !this.isBufferLoading) {
      this.loadAllCustomSounds();
    }

    const t = this.ctx.currentTime;

    // 1. If custom M4A1 gunshot sound file is loaded, play it!
    if (this.gunshotBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.gunshotBuffer;
      // Slight pitch variation for acoustic realism
      source.playbackRate.value = 0.98 + Math.random() * 0.04;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.9, t);
      source.connect(gain);
      gain.connect(this.masterGain);

      source.start(t);
      return;
    }

    // 2. Realistic M4A1 Gunshot sound synthesis (Fallback)
    // 1. Initial High-Frequency Transient / Crack (Muzzle Blast)
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3200, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    noiseFilter.Q.value = 2.5;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.15);

    // 2. Low-end Punch / Boom (Gun body thump)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.9, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);

    // 3. Tail Reverb / Environmental Room Echo
    const echoBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.45, this.ctx.sampleRate);
    const echoData = echoBuffer.getChannelData(0);
    for (let i = 0; i < echoBuffer.length; i++) {
      echoData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
    }
    const echo = this.ctx.createBufferSource();
    echo.buffer = echoBuffer;

    const echoFilter = this.ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.setValueAtTime(1200, t);
    echoFilter.frequency.linearRampToValueAtTime(400, t + 0.4);

    const echoGain = this.ctx.createGain();
    echoGain.gain.setValueAtTime(0.35, t + 0.04);
    echoGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    echo.connect(echoFilter);
    echoFilter.connect(echoGain);
    echoGain.connect(this.masterGain);
    echo.start(t + 0.03);
    echo.stop(t + 0.46);
  }

  // Dry fire empty chamber click
  public playDryFire() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Hitmarker sound (Headshot vs Body vs Steel Plate)
  public playHitSound(type: 'HEAD' | 'TORSO' | 'LIMB' | 'STEEL_GONG') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (type === 'HEAD') {
      // Crisp satisfying high-register ping + crack
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1600, t);
      osc1.frequency.exponentialRampToValueAtTime(2400, t + 0.04);
      osc1.frequency.exponentialRampToValueAtTime(1800, t + 0.15);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3200, t);
      osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.23);
      osc2.stop(t + 0.23);
    } else if (type === 'STEEL_GONG') {
      // Resonant metallic plate ring
      const frequencies = [820, 1280, 2140];
      frequencies.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4 / (idx + 1), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } else {
      // Body dummy thump
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.13);
    }
  }

  // Reload Duration matching ReloadSound.wav exactly
  // User requested: "reload hızı reload sesi saniyesi kadar olsun aq ismi ReloadSound.wav"
  public getReloadDuration(): number {
    if (this.reloadBuffer && this.reloadBuffer.duration > 0) {
      return this.reloadBuffer.duration;
    }
    return 3.355; // Exact duration of ReloadSound.wav
  }

  // Realistic magazine reload sequence using ReloadSound.wav
  public playReloadSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (this.reloadBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.reloadBuffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.95, t);
      src.connect(gain);
      gain.connect(this.masterGain);
      src.start(t);
      return;
    }

    // Fallback synthetic clicks if file is still loading
    // 1. Mag out click at t+0.2s
    this.playClick(t + 0.2, 700, 0.05, 0.3);
    // 2. Mag drop swoosh at t+0.5s
    this.playClick(t + 0.5, 400, 0.08, 0.25);
    // 3. New mag inserted clack at t+1.3s
    this.playClick(t + 1.25, 950, 0.07, 0.5);
    this.playClick(t + 1.35, 1200, 0.05, 0.6);
    // 4. Bolt release slam at t+1.75s
    this.playClick(t + 1.75, 450, 0.09, 0.7);
    this.playClick(t + 1.80, 1600, 0.04, 0.5);
  }

  // ==========================================
  // RUNNING SOUND (RunningSound.wav)
  // User requested:
  // "durduğumuzda ana sesi kes ve dur aq boşver neyse nedir aq
  //  zaten o RunStop.wav artık gözükmeyecektir sildim çünkü"
  // ==========================================

  public startRunning() {
    if (this.isRunningSoundPlaying) return;
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    if (this.runningBuffer) {
      this.isRunningSoundPlaying = true;
      const src = this.ctx.createBufferSource();
      src.buffer = this.runningBuffer;
      src.loop = true;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(1.8, this.ctx.currentTime);

      src.connect(gain);
      gain.connect(this.masterGain);

      this.currentRunningSource = src;
      this.runningGain = gain;
      src.start();
    }
  }

  public stopRunning() {
    if (!this.isRunningSoundPlaying && !this.currentRunningSource) return;
    this.isRunningSoundPlaying = false;
    if (this.runningGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.runningGain.gain.setValueAtTime(this.runningGain.gain.value, now);
        this.runningGain.gain.linearRampToValueAtTime(0.001, now + 0.04);
      } catch {
        // ignore
      }
    }
    const srcToStop = this.currentRunningSource;
    this.currentRunningSource = null;
    this.runningGain = null;
    if (srcToStop) {
      setTimeout(() => {
        try {
          srcToStop.stop();
        } catch {
          // ignore
        }
      }, 45);
    }
  }

  public stopRunningImmediate() {
    this.stopRunning();
  }

  private playClick(time: number, freq: number, duration: number, vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // Shell casing bounce clink
  public playShellBounce() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime + 0.35; // delay after shot
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(2800, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Fire mode selector switch sound
  public playFireModeSwitch() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    this.playClick(this.ctx.currentTime, 1400, 0.03, 0.35);
  }

  // Target dummy flip / knockdown mechanical thump
  public playTargetKnockdown() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Countdown beep for timed challenge
  public playCountdownBeep(high: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 1000 : 500, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (high ? 0.35 : 0.15));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + (high ? 0.36 : 0.16));
  }
}

export const audioManager = new AudioManager();
