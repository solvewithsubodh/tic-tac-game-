class SoundEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.muted = false;
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playX() {
    this.playTone(880, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(1760, 'sine', 0.1, 0.1), 50);
  }

  playO() {
    this.playTone(440, 'triangle', 0.15, 0.2);
    setTimeout(() => this.playTone(330, 'triangle', 0.15, 0.1), 80);
  }

  playWin() {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'square', 0.2, 0.1), i * 100);
    });
  }

  playLose() {
    const notes = [440, 415, 392, 370];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.3, 0.1), i * 150);
    });
  }

  playDraw() {
    this.playTone(440, 'triangle', 0.3, 0.1);
    setTimeout(() => this.playTone(440, 'triangle', 0.3, 0.1), 200);
  }

  playClick() {
    this.playTone(1200, 'sine', 0.05, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

const sounds = new SoundEngine();

// Hook up button clicks globally
document.addEventListener('click', (e) => {
  if (e.target.closest('button')) {
    sounds.playClick();
  }
});
