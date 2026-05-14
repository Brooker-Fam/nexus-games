// ── ATARI PONG SHELL ──
// Placeholder lifecycle only. Pong gameplay is owned by the Pong-core branch.

const pongCanvas = document.getElementById('pongCanvas');
const pongCtx = pongCanvas ? pongCanvas.getContext('2d') : null;
const PONG_SHELL_MESSAGE = 'PONG CORE LANDING SOON';

function pongDrawShell(){
  if(!pongCtx || !pongCanvas) return;

  const w = pongCanvas.width;
  const h = pongCanvas.height;
  pongCtx.clearRect(0, 0, w, h);

  pongCtx.fillStyle = '#020810';
  pongCtx.fillRect(0, 0, w, h);

  pongCtx.strokeStyle = 'rgba(232,244,255,0.35)';
  pongCtx.setLineDash([14, 18]);
  pongCtx.lineWidth = 4;
  pongCtx.beginPath();
  pongCtx.moveTo(w / 2, 28);
  pongCtx.lineTo(w / 2, h - 28);
  pongCtx.stroke();
  pongCtx.setLineDash([]);

  pongCtx.fillStyle = 'rgba(232,244,255,0.82)';
  pongCtx.fillRect(70, h / 2 - 52, 10, 104);
  pongCtx.fillRect(w - 80, h / 2 - 52, 10, 104);

  pongCtx.fillStyle = 'rgba(0,245,255,0.85)';
  pongCtx.fillRect(w / 2 - 8, h / 2 - 8, 16, 16);

  pongCtx.font = '700 28px Orbitron, monospace';
  pongCtx.textAlign = 'center';
  pongCtx.fillStyle = '#e8f4ff';
  pongCtx.fillText(PONG_SHELL_MESSAGE, w / 2, h / 2 + 72);

  pongCtx.font = '16px Rajdhani, sans-serif';
  pongCtx.fillStyle = 'rgba(232,244,255,0.58)';
  pongCtx.fillText('Entry point: js/pong/game.js · Registry ID: pong', w / 2, h / 2 + 104);
}

function pongReset(){
  pongDrawShell();
}

registerGame('pong', {
  init(){
    const status = document.getElementById('pongStatus');
    if(status) status.textContent = 'READY';
    pongDrawShell();
  },
  cleanup(){
    const status = document.getElementById('pongStatus');
    if(status) status.textContent = 'SHELL';
  },
});

//# sourceMappingURL=game.js.map
