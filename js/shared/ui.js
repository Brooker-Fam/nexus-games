// ── PARTICLES ──
(function(){
  const wrap = document.getElementById('particles');
  for(let i=0;i<25;i++){
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random()*3+1;
    const colors = ['#00f5ff','#0088ff','#8800ff','#00ff88'];
    p.style.cssText = `
      width:${sz}px; height:${sz}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      box-shadow: 0 0 ${sz*3}px currentColor;
      animation-duration:${Math.random()*12+8}s;
      animation-delay:${Math.random()*8}s;
    `;
    wrap.appendChild(p);
  }
})();

// ── INTERFACE ZOOM ──
(function(){
  const zoomOut = document.getElementById('zoom-out');
  const zoomIn = document.getElementById('zoom-in');
  const zoomLabel = document.getElementById('zoom-label');
  const minZoom = 1;
  const maxZoom = 1.35;
  const step = 0.05;
  const defaultZoom = 1.15;

  if(!zoomOut || !zoomIn || !zoomLabel) return;

  function clampZoom(value){
    return Math.min(maxZoom, Math.max(minZoom, value));
  }

  function updateZoom(value){
    const zoom = clampZoom(value);
    document.body.style.setProperty('--ui-zoom', zoom.toFixed(2));
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= minZoom;
    zoomIn.disabled = zoom >= maxZoom;
    try {
      localStorage.setItem('nexus-ui-zoom', zoom.toFixed(2));
    } catch(e) {
      // Ignore storage failures so the zoom buttons still work.
    }
  }

  let savedZoom = defaultZoom;
  try {
    savedZoom = parseFloat(localStorage.getItem('nexus-ui-zoom')) || defaultZoom;
  } catch(e) {
    savedZoom = defaultZoom;
  }

  updateZoom(savedZoom);
  zoomOut.addEventListener('click', () => updateZoom(savedZoom = clampZoom(savedZoom - step)));
  zoomIn.addEventListener('click', () => updateZoom(savedZoom = clampZoom(savedZoom + step)));
})();

//# sourceMappingURL=ui.js.map
