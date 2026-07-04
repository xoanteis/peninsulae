// WebAudio soundscape: real CC0 Kenney SFX + Kevin MacLeod underscore.
// Positional volumes relative to the camera target; throttled per-sound.

const SFX = {
  sword_1: 'assets/audio/sfx/sword_clash_1.ogg',
  sword_2: 'assets/audio/sfx/sword_clash_2.ogg',
  sword_3: 'assets/audio/sfx/sword_clash_3.ogg',
  arrow: 'assets/audio/sfx/arrow_shoot.ogg',
  thud: 'assets/audio/sfx/body_impact_thud.ogg',
  build_place: 'assets/audio/sfx/build_place.ogg',
  hammer: 'assets/audio/sfx/construction_hammer.ogg',
  collapse: 'assets/audio/sfx/building_collapse.ogg',
  collapse2: 'assets/audio/sfx/building_collapse_alt.ogg',
  horn: 'assets/audio/sfx/horn_alert.ogg',
  ui_click: 'assets/audio/sfx/ui_click.ogg',
  ui_open: 'assets/audio/sfx/ui_open.ogg',
  ui_close: 'assets/audio/sfx/ui_close.ogg',
  ui_error: 'assets/audio/sfx/ui_error.wav',
  victory: 'assets/audio/sfx/victory_fanfare.ogg',
  defeat: 'assets/audio/sfx/defeat_sting.ogg',
  era: 'assets/audio/sfx/era_advance.ogg',
  chime: 'assets/audio/sfx/region_captured_chime.wav',
  coins: 'assets/audio/sfx/resource_chime.ogg',
  blip: 'assets/audio/sfx/unit_select_blip.wav',
};

const MUSIC = {
  main: 'assets/audio/music/music_main.mp3',   // Minstrel Guild
  calm: 'assets/audio/music/music_alt1.mp3',   // The Builder
  somber: 'assets/audio/music/music_alt2.mp3', // Mourning Song
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.lastPlay = new Map();
    this.muted = false;
    this.musicSource = null;
    this.currentTrack = null;
    this.listener = { x: 0, z: 0, dist: 30 };
    this.pending = true;
  }

  async init() {
    // must be called after a user gesture
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    const load = async ([name, url]) => {
      try {
        const res = await fetch(url);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(name, buf);
      } catch (e) { console.warn('audio load failed', name, e); }
    };
    await Promise.all([...Object.entries(SFX), ...Object.entries(MUSIC)].map(load));
    this.pending = false;
    this.playMusic('main');
  }

  setListener(x, z, dist) { this.listener = { x, z, dist }; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
    return this.muted;
  }

  play(name, { volume = 1, rate = 1, jitter = 0.06, at = null, throttleMs = 70 } = {}) {
    if (!this.ctx || this.muted) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    const now = performance.now();
    if (now - (this.lastPlay.get(name) ?? 0) < throttleMs) return;
    this.lastPlay.set(name, now);

    let vol = volume;
    if (at) {
      const d = Math.hypot(at.x - this.listener.x, at.z - this.listener.z);
      const audible = 18 + this.listener.dist * 0.8;
      if (d > audible) return;
      vol *= Math.max(0.12, 1 - d / audible);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  playMusic(track) {
    if (!this.ctx || this.currentTrack === track) return;
    const buf = this.buffers.get(track);
    if (!buf) return;
    if (this.musicSource) {
      try { this.musicSource.stop(this.ctx.currentTime + 1.2); } catch { /* noop */ }
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.musicGain);
    src.start(this.ctx.currentTime + (this.musicSource ? 1.1 : 0.2));
    this.musicSource = src;
    this.currentTrack = track;
    // quiet underscore
    this.musicGain.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 2.5);
  }

  // ---- event mapping ----
  handleEvent(ev, world, humanId) {
    switch (ev.type) {
      case 'attack':
        if (ev.ranged) this.play('arrow', { volume: 0.5, at: { x: ev.x, z: ev.z } });
        else this.play(`sword_${1 + (Math.random() * 3 | 0)}`, { volume: 0.55, at: { x: ev.x, z: ev.z } });
        break;
      case 'unit_died':
        this.play('thud', { volume: 0.7, at: { x: ev.x, z: ev.z } });
        break;
      case 'building_placed':
        if (ev.owner === humanId) this.play('build_place', { volume: 0.9 });
        break;
      case 'work_pulse':
        if (ev.task === 'construct') this.play('hammer', { volume: 0.35, at: { x: ev.x, z: ev.z }, throttleMs: 450 });
        break;
      case 'building_complete':
        if (ev.owner === humanId) this.play('build_place', { volume: 0.9, rate: 1.15 });
        break;
      case 'building_destroyed':
        this.play(Math.random() < 0.5 ? 'collapse' : 'collapse2', { volume: 0.9, at: tileAt(ev) });
        break;
      case 'under_attack':
        if (ev.owner === humanId) this.play('horn', { volume: 0.95, throttleMs: 4000 });
        break;
      case 'region_flipped':
        this.play('chime', { volume: ev.owner === humanId ? 0.9 : 0.45, rate: ev.owner === humanId ? 1 : 0.85 });
        break;
      case 'conversion_started':
        if (ev.owner === humanId) this.play('coins', { volume: 0.8 });
        break;
      case 'era_advanced':
        if (ev.owner === humanId) this.play('era', { volume: 1 });
        break;
      case 'train_complete':
        if (ev.owner === humanId) this.play('blip', { volume: 0.5, throttleMs: 300 });
        break;
      case 'upgrade_bought':
        if (ev.owner === humanId) this.play('era', { volume: 0.6, rate: 1.3 });
        break;
      case 'victory':
        this.play(ev.owner === humanId ? 'victory' : 'defeat', { volume: 1 });
        this.playMusic(ev.owner === humanId ? 'main' : 'somber');
        break;
      case 'nation_fell':
        if (ev.owner === humanId) { this.play('defeat', { volume: 1 }); this.playMusic('somber'); }
        break;
      case 'ui_error':
        this.play('ui_error', { volume: 0.6 });
        break;
    }
  }
}

function tileAt(ev) {
  const COL = 2.0, ROW = 1.7320508;
  return ev.col != null ? { x: ev.col * COL + (ev.row & 1 ? 1 : 0), z: ev.row * ROW } : null;
}
