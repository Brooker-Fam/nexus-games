// ══════════════════════════════════════════════
//  DOOM — Audio (music loop + extended SFX)
// ══════════════════════════════════════════════
//  Uses the shared Web Audio engine in js/shared/audio.js.
//  No external audio files are required — everything is
//  synthesised. If the project later ships real WAV/MP3
//  music, swap doomMusicStart() for a HTMLAudioElement
//  with .loop = true.
//
//  Assets that *could* be added in the future:
//    - assets/doom/music/e1m1.ogg      (intro track loop)
//    - assets/doom/music/arena.ogg     (mid-tempo arena loop)
//    - assets/doom/music/sanctum.ogg   (final-floor loop)
//    - assets/doom/sfx/door_open.wav
//    - assets/doom/sfx/door_close.wav
//    - assets/doom/sfx/exit_switch.wav
//  Until those exist, the procedural fallback below ships sound
//  with zero asset weight.

// ── Extended SFX registered with the shared sfx() router ──
if(typeof SFX !== 'undefined'){
  SFX.doomDoor      = ()=>{ sfxTone(160,'sawtooth',0.18,0.02,0.4,80); sfxNoise(0.08,0.35,400); };
  SFX.doomDoorClose = ()=>{ sfxTone(110,'sawtooth',0.2,0.005,0.3,55); sfxNoise(0.1,0.25,300); };
  SFX.doomExit      = ()=>{ [262,330,392,523].forEach((f,i)=>setTimeout(()=>sfxTone(f,'sine',0.22,0.02,0.25),i*90)); };
  SFX.doomLevelStart= ()=>{ [196,247,294,392].forEach((f,i)=>setTimeout(()=>sfxTone(f,'square',0.18,0.01,0.18),i*70)); };
  SFX.doomMenuMove  = ()=>{ sfxTone(660,'square',0.08,0.005,0.05); };
  SFX.doomMenuPick  = ()=>{ sfxTone(880,'square',0.14,0.005,0.08,1320); sfxTone(1320,'square',0.08,0.01,0.08); };
  SFX.doomArmor     = ()=>{ sfxTone(440,'square',0.16,0.005,0.1,660); sfxNoise(0.06,0.04,2400); };
  SFX.doomWeapon    = ()=>{ sfxTone(523,'sawtooth',0.18,0.005,0.12,1047); sfxTone(784,'sawtooth',0.12,0.01,0.1); };
}

// ── Procedural music loop ──
//
// A simple bass pulse + lead arpeggio scheduled with Web Audio's
// own clock. setInterval drives a 2-bar pattern; per-track tempo
// and notes vary so each level feels different without shipping
// a single audio file.

const DOOM_MUSIC_TRACKS = {
  // E1M1 — driving bass + ostinato lead, 132 BPM
  doomMusicHangar: {
    bpm: 132,
    bass:  [49, 49, 56, 56, 47, 47, 54, 54],   // MIDI numbers
    lead:  [76, 79, 81, 79, 74, 77, 79, 77],
    leadGain: 0.05,
    bassGain: 0.08,
  },
  // Test pit — punchier, 150 BPM
  doomMusicPit: {
    bpm: 150,
    bass:  [45, 45, 45, 47, 50, 50, 52, 52],
    lead:  [69, 72, 76, 72, 71, 74, 76, 74],
    leadGain: 0.04,
    bassGain: 0.07,
  },
  // Sanctum — slower, doomier, 96 BPM
  doomMusicSanctum: {
    bpm: 96,
    bass:  [41, 41, 41, 41, 39, 39, 39, 39],
    lead:  [68, 71, 75, 78, 75, 71, 68, 65],
    leadGain: 0.05,
    bassGain: 0.10,
  },
};

const _doomMusic = {
  trackId: null,
  intervalId: null,
  step: 0,
  enabled: true,
  master: 0.5,
};

function _doomMidiToHz(midi){
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function _doomMusicTick(){
  if(!_doomMusic.enabled) return;
  const track = DOOM_MUSIC_TRACKS[_doomMusic.trackId];
  if(!track) return;
  const i = _doomMusic.step % track.bass.length;
  const bassHz = _doomMidiToHz(track.bass[i]);
  const leadHz = _doomMidiToHz(track.lead[i]);
  // Bass tone — saw + short decay
  sfxTone(bassHz, 'sawtooth', track.bassGain * _doomMusic.master, 0.01, 0.22);
  // Lead — softer triangle, longer
  sfxTone(leadHz, 'triangle', track.leadGain * _doomMusic.master, 0.015, 0.32);
  // Light percussion every 2nd step
  if(i % 2 === 0){
    sfxNoise(0.025 * _doomMusic.master, 0.05, 6000);
  }
  _doomMusic.step++;
}

function doomMusicStart(trackId){
  if(!DOOM_MUSIC_TRACKS[trackId]) trackId = 'doomMusicHangar';
  doomMusicStop();
  _doomMusic.trackId = trackId;
  _doomMusic.step = 0;
  const bpm = DOOM_MUSIC_TRACKS[trackId].bpm;
  const stepMs = Math.round(60000 / bpm / 2);   // eighth-note pulse
  _doomMusic.intervalId = setInterval(_doomMusicTick, stepMs);
  // Fire one tick immediately so there's no "silent gap" on level start
  _doomMusicTick();
}

function doomMusicStop(){
  if(_doomMusic.intervalId){
    clearInterval(_doomMusic.intervalId);
    _doomMusic.intervalId = null;
  }
  _doomMusic.trackId = null;
}

function doomMusicSetEnabled(on){
  _doomMusic.enabled = !!on;
  if(!on) doomMusicStop();
}

// Expose for flow / game modules.
window.doomMusicStart = doomMusicStart;
window.doomMusicStop = doomMusicStop;
window.doomMusicSetEnabled = doomMusicSetEnabled;
