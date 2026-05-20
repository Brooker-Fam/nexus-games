// ════════════════════════════════════════════════════
//  CITADEL OPS — ENTITY FACTORIES
// ════════════════════════════════════════════════════
//
// Three families of entities:
//   - Buildings (HQ, BARRACKS, TECH)  side-owned, stationary, occupy a tile
//   - Units     (WORKER, SOLDIER)     side-owned, mobile, attack capable
//   - Resources (GOLD_NODE)           neutral, depletes when mined
//
// Each entity has:
//   .type      string, one of ISO_TYPE.*
//   .kind      'building' | 'unit' | 'resource'
//   .side      Side ref (null for neutral resources)
//   .hp / .maxHp
//   .components — bag carrying movement state, attack target, etc.
//
// All entities provide a `components.render(ctx, ent, cam)` callback so
// the foundation's `drawWorld` picks them up automatically.

const ISO_TYPE = Object.freeze({
  HQ:        'hq',
  BARRACKS:  'barracks',
  TECH:      'tech',
  WORKER:    'worker',
  SOLDIER:   'soldier',
  GOLD_NODE: 'gold_node',
});

const ISO_STATS = Object.freeze({
  [ISO_TYPE.HQ]:        { kind:'building', cost:0,  hp:600, supply:ISO_HQ_SUPPLY_BONUS, tileR:1,   buildTimeMs:0    },
  [ISO_TYPE.BARRACKS]:  { kind:'building', cost:60, hp:350, supply:0,                   tileR:1,   buildTimeMs:6000 },
  [ISO_TYPE.TECH]:      { kind:'building', cost:50, hp:300, supply:0,                   tileR:1,   buildTimeMs:5000 },
  [ISO_TYPE.WORKER]:    { kind:'unit',     cost:20, hp:40,  supply:1, dmg:3,  rng:18,  speed:60,  trainMs:3500 },
  [ISO_TYPE.SOLDIER]:   { kind:'unit',     cost:30, hp:80,  supply:2, dmg:10, rng:22,  speed:70,  trainMs:5000 },
  [ISO_TYPE.GOLD_NODE]: { kind:'resource', cost:0,  hp:9999, amount:600, tickAmount:5 },
});

// ── Building factory ────────────────────────────────
function isoMakeBuilding(world, side, type, col, row, opts){
  opts = opts || {};
  const st = ISO_STATS[type];
  const w = tileToWorld(col, row);
  const ent = new Entity({ type, x:w.x, y:w.y });
  ent.kind   = 'building';
  ent.side   = side;
  ent.col    = col;
  ent.row    = row;
  ent.tileR  = st.tileR;
  ent.hp     = st.hp;
  ent.maxHp  = st.hp;
  ent.dead   = false;
  ent.components.building = {
    type,
    construction: opts.completed ? 1 : 0,           // 0..1
    buildTimeMs:  st.buildTimeMs,
    trainQueue:   [],                                // array of { type, elapsedMs, timeMs }
    rallyCol:     col,                               // where new units walk to
    rallyRow:     row + 2,
  };
  ent.components.render = _renderBuilding;
  if (st.supply){ side.supplyMax += st.supply; }
  world.add(ent);
  return ent;
}

// ── Unit factory ───────────────────────────────────
function isoMakeUnit(world, side, type, x, y){
  const st = ISO_STATS[type];
  const ent = new Entity({ type, x, y });
  ent.kind   = 'unit';
  ent.side   = side;
  ent.hp     = st.hp;
  ent.maxHp  = st.hp;
  ent.dead   = false;
  ent.components.unit = {
    speed:    st.speed,
    dmg:      st.dmg,
    rng:      st.rng,
    cooldown: 0,
    cooldownMs: type === ISO_TYPE.SOLDIER ? 800 : 1200,
  };
  ent.components.movement = {
    targetX: x, targetY: y,
    moving:  false,
  };
  ent.components.order = {           // current high-level order
    kind: 'idle',
    targetId: null,                  // entity id (attack/gather/build target)
    targetX: null, targetY: null,    // move position
    state:    null,                  // 'to_resource' | 'mining' | 'to_hq' | 'returning'
    cargoGold: 0,                    // worker carry amount
    homeBuildingId: null,            // worker drop-off (HQ)
  };
  ent.components.render = _renderUnit;
  side.supplyUsed += st.supply;
  world.add(ent);
  return ent;
}

// ── Gold node factory ──────────────────────────────
function isoMakeGoldNode(world, col, row, amount){
  const st = ISO_STATS[ISO_TYPE.GOLD_NODE];
  const w = tileToWorld(col, row);
  const ent = new Entity({ type: ISO_TYPE.GOLD_NODE, x:w.x, y:w.y });
  ent.kind    = 'resource';
  ent.side    = null;
  ent.col     = col;
  ent.row     = row;
  ent.hp      = st.hp;
  ent.maxHp   = st.hp;
  ent.dead    = false;
  ent.remaining = amount != null ? amount : st.amount;
  ent.components.render = _renderGoldNode;
  world.add(ent);
  return ent;
}

// ── Rendering helpers ──────────────────────────────
function _renderBuilding(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  const f = ent.side.faction;
  const built = ent.components.building.construction;
  const sizeBase = ent.type === ISO_TYPE.HQ ? 30 : 22;
  const half = sizeBase;
  const tall = ent.type === ISO_TYPE.HQ ? 28 : 20;

  // base footprint (slightly transparent during construction)
  ctx.globalAlpha = 0.35 + 0.55 * built;
  ctx.beginPath();
  ctx.moveTo(s.x,          s.y - half * 0.5);
  ctx.lineTo(s.x + half,   s.y);
  ctx.lineTo(s.x,          s.y + half * 0.5);
  ctx.lineTo(s.x - half,   s.y);
  ctx.closePath();
  const grad = ctx.createLinearGradient(s.x, s.y - tall, s.x, s.y + half * 0.5);
  grad.addColorStop(0, f.accent);
  grad.addColorStop(1, f.buildingFill);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = f.buildingEdge;
  ctx.stroke();

  // raised "tower" silhouette
  ctx.beginPath();
  ctx.moveTo(s.x - half * 0.6, s.y - 2);
  ctx.lineTo(s.x - half * 0.6, s.y - tall);
  ctx.lineTo(s.x + half * 0.6, s.y - tall);
  ctx.lineTo(s.x + half * 0.6, s.y - 2);
  ctx.closePath();
  ctx.fillStyle = f.buildingFill;
  ctx.fill();
  ctx.strokeStyle = f.buildingEdge;
  ctx.stroke();

  // roof cap
  ctx.beginPath();
  ctx.moveTo(s.x,            s.y - tall - 8);
  ctx.lineTo(s.x + half*0.6, s.y - tall);
  ctx.lineTo(s.x - half*0.6, s.y - tall);
  ctx.closePath();
  ctx.fillStyle = f.color;
  ctx.fill();
  ctx.strokeStyle = f.buildingEdge;
  ctx.stroke();

  ctx.globalAlpha = 1;

  // HQ has a small glow
  if (ent.type === ISO_TYPE.HQ){
    ctx.beginPath();
    ctx.arc(s.x, s.y - tall - 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = f.accent;
    ctx.fill();
  }

  // construction progress bar
  if (built < 1){
    const w = 50;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(s.x - w/2, s.y - tall - 18, w, 5);
    ctx.fillStyle = f.color;
    ctx.fillRect(s.x - w/2, s.y - tall - 18, w * built, 5);
    ctx.strokeStyle = f.buildingEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x - w/2, s.y - tall - 18, w, 5);
  } else if (ent.hp < ent.maxHp){
    _drawHpBar(ctx, s.x, s.y - tall - 14, 50, ent.hp / ent.maxHp);
  }
}

function _renderUnit(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  const f = ent.side.faction;
  const isWorker = ent.type === ISO_TYPE.WORKER;
  const fill   = isWorker ? f.workerColor : f.warriorColor;
  const radius = isWorker ? 5 : 7;

  // shadow under feet
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 4, radius + 1, (radius + 1) / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  if (isWorker){
    ctx.beginPath();
    ctx.arc(s.x, s.y - 3, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = f.buildingEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    // cargo glint when carrying gold
    if (ent.components.order && ent.components.order.cargoGold > 0){
      ctx.beginPath();
      ctx.arc(s.x, s.y - 9, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd66';
      ctx.fill();
    }
  } else {
    // soldier: small diamond
    ctx.beginPath();
    ctx.moveTo(s.x,             s.y - 3 - radius);
    ctx.lineTo(s.x + radius,    s.y - 3);
    ctx.lineTo(s.x,             s.y - 3 + radius);
    ctx.lineTo(s.x - radius,    s.y - 3);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  if (ent.hp < ent.maxHp){
    _drawHpBar(ctx, s.x, s.y - radius - 10, 22, ent.hp / ent.maxHp);
  }
}

function _renderGoldNode(ctx, ent, cam){
  const s = worldToScreen(ent.x, ent.y, cam);
  const r = 9;
  ctx.beginPath();
  ctx.moveTo(s.x,       s.y - r);
  ctx.lineTo(s.x + r,   s.y);
  ctx.lineTo(s.x,       s.y + r);
  ctx.lineTo(s.x - r,   s.y);
  ctx.closePath();
  const grad = ctx.createLinearGradient(s.x, s.y - r, s.x, s.y + r);
  grad.addColorStop(0, '#ffe066');
  grad.addColorStop(1, '#aa7800');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#ffcc44';
  ctx.lineWidth = 1;
  ctx.stroke();
  // remaining indicator
  const frac = Math.max(0, ent.remaining / ISO_STATS[ISO_TYPE.GOLD_NODE].amount);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(s.x - r, s.y + r + 2, r * 2, 3);
  ctx.fillStyle = '#ffcc44';
  ctx.fillRect(s.x - r, s.y + r + 2, r * 2 * frac, 3);
}

function _drawHpBar(ctx, cx, cy, w, frac){
  const h = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(cx - w/2, cy, w, h);
  const c = frac > 0.55 ? '#00ff88' : (frac > 0.25 ? '#ffcc44' : '#ff0066');
  ctx.fillStyle = c;
  ctx.fillRect(cx - w/2, cy, w * Math.max(0, frac), h);
}

window.ISO_TYPE         = ISO_TYPE;
window.ISO_STATS        = ISO_STATS;
window.isoMakeBuilding  = isoMakeBuilding;
window.isoMakeUnit      = isoMakeUnit;
window.isoMakeGoldNode  = isoMakeGoldNode;
