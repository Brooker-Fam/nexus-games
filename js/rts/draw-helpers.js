// ── SHARED DRAWING HELPERS ──

function drawHealthBar(rc, x, y, bw, bh, hp, maxHp, colorMode){
  const frac=Math.max(0, hp/maxHp);
  rc.fillStyle='rgba(0,0,0,0.5)';
  rc.fillRect(x-bw/2, y, bw, bh);
  if(colorMode==='fixed'){
    rc.fillStyle='#00ff88';
  } else {
    rc.fillStyle=frac>0.5?'#00ff88':frac>0.25?'#ffaa00':'#ff2244';
  }
  rc.fillRect(x-bw/2, y, bw*frac, bh);
}

function drawSelectionRing(rc, x, y, rw, rh, lineWidth){
  rc.save();
  rc.strokeStyle='#00ff88';
  rc.lineWidth=lineWidth||2;
  rc.shadowColor='#00ff88';
  rc.shadowBlur=10;
  rc.beginPath();
  rc.ellipse(x, y, rw, rh, 0, 0, Math.PI*2);
  rc.stroke();
  rc.restore();
}

//# sourceMappingURL=draw-helpers.js.map
