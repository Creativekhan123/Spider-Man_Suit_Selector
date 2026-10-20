/**
 * Web Audio API Sci-Fi Sound Synthesizer
 * Generates futuristic Marvel / Stark Industries audio cues procedurally.
 */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._initOnFirstUserGesture();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          try { window.speechSynthesis.getVoices(); } catch (e) {}
        };
      }
    }
  }

  _initOnFirstUserGesture() {
    const unlock = () => {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle(force) {
    this.enabled = force !== undefined ? force : !this.enabled;
    return this.enabled;
  }

  /**
   * Stark JARVIS System Boot Chime
   */
  playBoot() {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.85);
    });
  }

  /**
   * Crisp Holographic Laser Pinch Click
   */
  playPinch() {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(3200, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.09);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Pinch Release Sound
   */
  playRelease() {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Deep Pedestal Materialization Shockwave & Bass Drop
   */
  playDock() {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    // Sub-bass thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + 0.65);

    // Filtered high-energy sweep
    this.playWhoosh(1.2);
  }

  /**
   * Hologram Glide Whoosh
   */
  playWhoosh(intensity = 1.0) {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.32);
  }

  /**
   * Hover Blip
   */
  playHover() {
    if (!this.enabled) return;
    this._ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.setValueAtTime(3200, now + 0.02);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * J.A.R.V.I.S. / Karen A.I. Tactical Audio Announcement
   */
  speak(text) {
    if (!this.enabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 0.98;
      utter.volume = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const starkVoice = voices.find(v => v.lang.startsWith('en') && (
        v.name.includes('Samantha') || 
        v.name.includes('Zira') || 
        v.name.includes('Google') || 
        v.name.includes('Natural') || 
        v.name.includes('David') ||
        v.name.includes('English')
      )) || voices.find(v => v.lang.startsWith('en'));

      if (starkVoice) utter.voice = starkVoice;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('[SoundFX] Voice announcement skipped:', e);
    }
  }

  speakSuitDeployment(suit) {
    if (!suit) return;
    const announcements = {
      spiderman2: "Advanced Suit 2.0 deployed. Neural link synchronized.",
      spiderman3: "Webbed Raimi suit online. Organic webbing verified.",
      spiderman4: "Stealth Night Monkey suit activated. Optical camouflage engaged.",
      spiderman5: "Stark Enhanced suit ready. Karen A.I. protocol linked.",
      spiderman6: "Iron Spider Mark One deployed. Waldo arms standing by.",
      spiderman7: "Vintage Ditko comic suit materialized. Spider-Sense calibrated.",
      spiderman8: "Integrated Nanotech suit online. Golden emblem infused."
    };
    const phrase = announcements[suit.id] || `${suit.name} deployed. All systems operational.`;
    this.speak(phrase);
  }
}

export const soundFX = new SoundFX();
