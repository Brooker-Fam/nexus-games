// Homestead Wars — Shared Drawing Helpers

function hwDrawHealthBar(rc, x, y, bw, bh, hp, maxHp, colorMode){
  const frac=Math.max(0, hp/maxHp);
  rc.fillStyle='rgba(0,0,0,0.5)';
  rc.fillRect(x-bw/2, y, bw, bh);
  if(colorMode==='fixed'){
    rc.fillStyle='#44cc44';
  } else {
    rc.fillStyle=frac>0.5?'#44cc44':frac>0.25?'#ddaa00':'#dd3322';
  }
  rc.fillRect(x-bw/2, y, bw*frac, bh);
}

function hwDrawSelectionRing(rc, x, y, rw, rh, lineWidth){
  rc.save();
  rc.strokeStyle='#44cc44';
  rc.lineWidth=lineWidth||2;
  rc.shadowColor='#44cc44';
  rc.shadowBlur=10;
  rc.beginPath();
  rc.ellipse(x, y, rw, rh, 0, 0, Math.PI*2);
  rc.stroke();
  rc.restore();
}
