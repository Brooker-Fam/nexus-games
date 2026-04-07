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

// ── TAB SWITCH ──
function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
