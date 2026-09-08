// ── PROCEDURAL BATTLEFIELDS ──
// Maps are mirrored around the centre line so random layouts remain fair.
const RTS_MAPS = [
  { id:'orion', name:'ORION DIVIDE', colors:['#061321','#020913','#061321'], accent:'#00c8ff',
    lanes:[-310,0,310], quarters:[-220,220], center:[-340,-170,0,170,340], decor:'nebula' },
  { id:'helix', name:'HELIX CROSSING', colors:['#130a20','#060713','#130a20'], accent:'#a866ff',
    lanes:[-360,-120,120,360], quarters:[-330,0,330], center:[-260,-90,90,260], decor:'rift' },
  { id:'ember', name:'EMBER REACH', colors:['#1b0c0a','#09080e','#1b0c0a'], accent:'#ff6b35',
    lanes:[-260,0,260], quarters:[-360,-120,120,360], center:[-380,-190,0,190,380], decor:'embers' },
  { id:'verdant', name:'VERDANT EXPANSE', colors:['#061712','#04100f','#061712'], accent:'#38e09b',
    lanes:[-380,-190,0,190,380], quarters:[-250,250], center:[-300,-100,100,300], decor:'clouds' },
  { id:'nova', name:'SHATTERED NOVA', colors:['#151407','#080b12','#151407'], accent:'#ffe066',
    lanes:[-330,-110,110,330], quarters:[-380,0,380], center:[-320,-160,0,160,320], decor:'shards' },
];
const GOLD_MINE_CAPACITY = 1600;

function rtsMapRand(min,max){ return min+rtsRand()*(max-min); }

function makeBattlefield(){
  const map=RTS_MAPS[Math.floor(rtsRand()*RTS_MAPS.length)];
  S.map=map;
  S.mapDecor=[];

  // Random scenery is generated once rather than during drawing, keeping every
  // frame stable and lockstep multiplayer deterministic.
  const decorCount=map.decor==='shards'?34:24;
  for(let i=0;i<decorCount/2;i++){
    const decor={
      x:rtsMapRand(260,RW/2-90), y:rtsMapRand(90,RH-90),
      size:rtsMapRand(18,75), rotation:rtsMapRand(0,Math.PI*2), alpha:rtsMapRand(.08,.24),
    };
    S.mapDecor.push(decor, {...decor,x:RW-decor.x,rotation:Math.PI-decor.rotation});
  }
}

function addBaseGoldPair(angle,radius){
  const x=PLAYER_BASE_X+Math.cos(angle)*radius;
  const y=BASE_Y+Math.sin(angle)*radius;
  S.goldNodes.push({x,y,gold:GOLD_MINE_CAPACITY,maxGold:GOLD_MINE_CAPACITY,owner:'player'});
  S.goldNodes.push({x:RW-x,y,gold:GOLD_MINE_CAPACITY,maxGold:GOLD_MINE_CAPACITY,owner:'enemy'});
}

// Places one contested field mine at the given angle along the shared arc, plus
// its mirror image, unless the angle lands exactly on the arc's apex (x=RW/2).
function addFieldGoldPair(angle,radius,bulgeSign){
  const x=RW/2+Math.cos(angle)*radius;
  const y=BASE_Y-bulgeSign*Math.sin(angle)*radius;
  S.goldNodes.push({x,y,gold:GOLD_MINE_CAPACITY,maxGold:GOLD_MINE_CAPACITY,owner:'neutral'});
  const mirrorX=RW-x;
  if(Math.abs(mirrorX-x)>.001){
    S.goldNodes.push({x:mirrorX,y,gold:GOLD_MINE_CAPACITY,maxGold:GOLD_MINE_CAPACITY,owner:'neutral'});
  }
}

function makeMapGoldNodes(){
  S.goldNodes=[];
  const map=S.map||RTS_MAPS[0];
  // Every gold mine on the map sits on a semicircle: tight, inward-facing arcs
  // guard each base, and every contested field mine further out is strung
  // along one shared semicircle arcing above (or below) the base line.
  const arcInset=.18;
  for(let i=0;i<map.lanes.length;i++){
    const t=map.lanes.length===1 ? .5 : i/(map.lanes.length-1);
    const angle=-Math.PI/2+arcInset+t*(Math.PI-arcInset*2);
    addBaseGoldPair(angle,rtsMapRand(215,235));
  }
  // The preset defines the strategy; jitter, radius and bulge direction make repeat visits fresh.
  const fieldOffsets=[...new Set([...map.quarters,...map.center].map(Math.abs))].sort((a,b)=>a-b);
  const maxOffset=Math.max(...fieldOffsets,1);
  const fieldRadius=rtsMapRand(RW*.24,RW*.34);
  const bulgeSign=rtsRand()<.5?1:-1;
  for(const offset of fieldOffsets){
    const t=.5+offset/(2*maxOffset);
    const angle=arcInset+t*(Math.PI-arcInset*2);
    addFieldGoldPair(angle,fieldRadius+rtsMapRand(-16,16),bulgeSign);
  }
}
