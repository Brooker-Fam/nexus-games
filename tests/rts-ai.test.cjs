const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeContext(){
  const context = vm.createContext({
    STRUCT_COSTS: {
      barracks: { gold: 20 }, cannon: { gold: 20 },
      structure: { gold: 20, oil: 0 }, aerial: { gold: 20, oil: 0 },
      oilrig: { gold: 20 },
    },
    window: { _mpMultiplayer: false },
    canTargetAerial: () => true,
    S: { entities: [], playerBase: null, enemyBase: null },
    rtsRand: () => 0.5,
    console,
    Math,
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'rts', 'game.js'), 'utf8');
  vm.runInContext(source, context);
  return context;
}

test('base defence commits enough nearby units and targets the actual attackers', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    S.enemyBase={id:1,type:'base',side:'enemy',x:1000,y:500,hp:300};
    S.playerBase={id:2,type:'base',side:'player',x:0,y:500,hp:300};
    const threat={id:3,type:'warrior',side:'player',x:900,y:500,hp:20,maxHp:20,damage:4,fireRate:60,ranged:true};
    const near={id:4,type:'warrior',side:'enemy',x:980,y:500,state:'idle',hp:40,maxHp:40,damage:10,ranged:false};
    const far={id:5,type:'warrior',side:'enemy',x:700,y:500,state:'idle',hp:40,maxHp:40,damage:10,ranged:false};
    S.entities=[S.enemyBase,S.playerBase,threat,far,near];
    aiDefendBase([threat]);
    return {nearState:near.state,nearTarget:near.forcedTarget&&near.forcedTarget.id,farState:far.state};
  })()`, context);
  assert.deepEqual({ ...result }, { nearState: 'march', nearTarget: 3, farState: 'idle' });
});

test('strategic attacks prioritize a vulnerable production building', () => {
  const context = makeContext();
  const targetId = vm.runInContext(`(() => {
    S.playerBase={id:1,type:'base',side:'player',x:0,y:0,hp:300};
    S.entities=[S.playerBase,
      {id:2,type:'worker',side:'player',x:20,y:0,hp:10},
      {id:3,type:'structure',side:'player',isBarracks:true,x:30,y:0,hp:120},
      {id:4,type:'structure',side:'player',isBarracks:true,x:40,y:0,hp:30}
    ];
    return aiChooseAttackTarget().id;
  })()`, context);
  assert.equal(targetId, 4);
});

test('army evaluation accounts for health, damage rate, and range', () => {
  const context = makeContext();
  const powers = vm.runInContext(`[
    aiCombatPower({type:'warrior',hp:100,maxHp:100,damage:10,ranged:false}),
    aiCombatPower({type:'warrior',hp:20,maxHp:100,damage:10,ranged:false}),
    aiCombatPower({type:'warrior',hp:100,maxHp:100,damage:10,ranged:true,fireRate:45,range:240})
  ]`, context);
  assert.ok(powers[0] > powers[1], 'healthy units should count for more');
  assert.ok(powers[2] > powers[0], 'fast ranged damage should count for more');
});

test('Prism attack summons 10 Legionnaires focused on her target', () => {
  const context=makeContext();
  const entitiesSource=fs.readFileSync(path.join(__dirname,'..','js','rts','entities.js'),'utf8');
  vm.runInContext(entitiesSource,context);
  context.FACTION_CFG={prism:{color:'#00ddff'}};
  context.spawnMagicBurst=()=>{};
  context.sfx=()=>{};

  const result=vm.runInContext(`(() => {
    const target={id:9,type:'warrior',side:'enemy',x:300,y:100,hp:40};
    const prism=makePrism('player','prism',100,100);
    prism.attackTimer=prism.fireRate-1;
    S.entities=[prism,target];
    advanceRangedAttack(prism,target);
    const summoned=S.entities.slice(2);
    return {
      count:S.entities.length,
      summonedCount:summoned.length,
      allLegionnaires:summoned.every(unit=>unit.subtype==='legionnaire'),
      allPlayerUnits:summoned.every(unit=>unit.side==='player'),
      allTargetEnemy:summoned.every(unit=>unit.forcedTarget.id===target.id),
      allMarching:summoned.every(unit=>unit.state==='march'),
      bowCount:summoned.filter(unit=>unit.bowMode).length,
      projectiles:S.projectiles ? S.projectiles.length : 0,
    };
  })()`,context);

  assert.deepEqual({...result},{
    count:12,
    summonedCount:10,
    allLegionnaires:true,
    allPlayerUnits:true,
    allTargetEnemy:true,
    allMarching:true,
    bowCount:5,
    projectiles:0,
  });
});

test('idle unit retaliates against whoever last hit it, even from outside its aggro range', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    S.frame=500;
    S.playerBase={id:1,type:'base',side:'player',x:-1000,y:0,hp:300};
    S.enemyBase={id:2,type:'base',side:'enemy',x:1000,y:0,hp:300};
    const victim={id:3,type:'warrior',side:'player',x:0,y:0,state:'idle',hp:50,maxHp:50,damage:10,range:50,ranged:false,speed:1,attackTimer:0};
    const attacker={id:4,type:'warrior',side:'enemy',x:600,y:0,hp:40,maxHp:40,damage:20,range:600,ranged:true,fireRate:100,speed:0.5,attackTimer:0};
    victim.lastAttacker=attacker;
    victim.lastAttackedFrame=490; // 10 ticks ago, still within the retaliation window
    S.entities=[S.playerBase,S.enemyBase,victim,attacker];
    warriorTick(victim, S.playerBase, S.enemyBase);
    return {state:victim.state, targetId:victim.forcedTarget&&victim.forcedTarget.id};
  })()`, context);
  assert.deepEqual({ ...result }, { state:'march', targetId:4 });
});

test('idle unit ignores a stale attacker once the retaliation window has passed', () => {
  const context = makeContext();
  const result = vm.runInContext(`(() => {
    S.frame=500;
    S.playerBase={id:1,type:'base',side:'player',x:-1000,y:0,hp:300};
    S.enemyBase={id:2,type:'base',side:'enemy',x:1000,y:0,hp:300};
    const victim={id:3,type:'warrior',side:'player',x:0,y:0,state:'idle',hp:50,maxHp:50,damage:10,range:50,ranged:false,speed:1,attackTimer:0};
    const attacker={id:4,type:'warrior',side:'enemy',x:600,y:0,hp:40,maxHp:40,damage:20,range:600,ranged:true,fireRate:100,speed:0.5,attackTimer:0};
    victim.lastAttacker=attacker;
    victim.lastAttackedFrame=200; // long past the retaliation window
    S.entities=[S.playerBase,S.enemyBase,victim,attacker];
    warriorTick(victim, S.playerBase, S.enemyBase);
    return {state:victim.state, forcedTarget:victim.forcedTarget||null};
  })()`, context);
  assert.deepEqual({ ...result }, { state:'idle', forcedTarget:null });
});

test('a direct projectile hit records the shooter as the last attacker, triggering retaliation', () => {
  const context = makeContext();
  Object.assign(context, { spawnHitFlash:()=>{}, spawnHitParticles2:()=>{}, spawnLightningHit:()=>{}, spawnMagicBurst:()=>{}, spawnDarkOrbBurst:()=>{} });
  const result = vm.runInContext(`(() => {
    S.frame=500;
    S.particles=[];
    S.playerBase={id:1,type:'base',side:'player',x:-1000,y:0,hp:300};
    S.enemyBase={id:2,type:'base',side:'enemy',x:1000,y:0,hp:300};
    const victim={id:3,type:'warrior',side:'player',x:0,y:0,state:'idle',hp:50,maxHp:50,damage:10,range:50,ranged:false,speed:1,attackTimer:0};
    const shooter={id:4,type:'warrior',side:'enemy',x:600,y:0,hp:40,maxHp:40,damage:20,range:600,ranged:true,fireRate:100,speed:0.5,attackTimer:0};
    S.entities=[S.playerBase,S.enemyBase,victim,shooter];
    S.projectiles=[{x:1,y:0,tx:victim,by:shooter,speed:8,damage:20,type:'bullet',trail:[],side:'enemy'}];
    updateProjectiles();
    warriorTick(victim, S.playerBase, S.enemyBase);
    return {hp:victim.hp, state:victim.state, targetId:victim.forcedTarget&&victim.forcedTarget.id};
  })()`, context);
  assert.deepEqual({ ...result }, { hp:30, state:'march', targetId:4 });
});
