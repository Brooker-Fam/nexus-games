// ── FACTION CONFIG (centralized) ──
// Game mechanics config
const FACTION_CFG={
  prism:{
    color:'#00ddff', accent:'#aaffff', workerColor:'#88ccff',
    warriorColor:'#ffffff', buildingName:'TEMPLE',
    workerLabel:'ACOLYTE', warriorLabel:'WITCH',
    workerCost:5,
    buildingColor:'#c0e8ff',
    barracksName:'PORTAL', barracksLabel:'PORTAL',
    warriorCost:10, warriorDesc:'Ranged — magic projectiles',
    structName:'SHRINE', structLabel:'SHRINE',
    eliteLabel:'ORACLE', eliteDesc:'Ranged — high damage prismatic bolts',
    eliteCost:30, eliteIcon:'🔮',
    elite2Label:'WIZARD', elite2Desc:'Ranged — chain lightning bounces between enemies',
    elite2Cost:18, elite2Icon:'⚡', elite2Fn:'makeWizard',
    // UI icons
    workerIcon:'🧙', warriorIcon:'✨',
    barracksIcon:'🌀', structIcon:'🏛', baseIcon:'🏰',
    cannonColor:'#00f5ff', cannonSound:'rtsPrismCannon',
    aerialName:'WARP CONDUIT', aerialLabel:'WARP CONDUIT', aerialIcon:'🌀',
    aerialUnitLabel:'STAR FIGHTER', aerialUnitDesc:'Aerial — fast energy bolts, immune to melee',
    aerialUnitCost:28, aerialUnitIcon:'✦', aerialFn:'makeStarFighter',
  },
  shadow:{
    color:'#9922ff', accent:'#dd88ff', workerColor:'#8855cc',
    warriorColor:'#cc88ff', buildingName:'TEMPLE',
    workerLabel:'SHADE', warriorLabel:'SWORDSMAN',
    workerCost:5,
    buildingColor:'#1a0030',
    barracksName:'TRAINING FIELD', barracksLabel:'TRAINING FIELD',
    warriorCost:10, warriorDesc:'Melee — fast sword charge',
    structName:'DARK SHRINE', structLabel:'DARK SHRINE',
    eliteLabel:'DARK WARRIOR', eliteDesc:'Ranged — black magic bolts that chain',
    eliteCost:30, eliteIcon:'🌑',
    elite2Label:'NECROMANCER', elite2Desc:'Raises dead Swordsmen — fast revive, strong damage',
    elite2Cost:22, elite2Icon:'💀', elite2Fn:'makeNecromancer',
    // UI icons
    workerIcon:'🥷', warriorIcon:'⚔',
    barracksIcon:'⚔', structIcon:'⚡', baseIcon:'🏰',
    cannonColor:'#cc44ff', cannonSound:'rtsShadowCannon',
    aerialName:'WARP CONDUIT', aerialLabel:'WARP CONDUIT', aerialIcon:'🌀',
    aerialUnitLabel:'STAR FIGHTER', aerialUnitDesc:'Aerial — fast energy bolts, immune to melee',
    aerialUnitCost:28, aerialUnitIcon:'✦', aerialFn:'makeStarFighter',
  },
  roboto:{
    color:'#ff8800', accent:'#ffcc44', workerColor:'#aa6622',
    warriorColor:'#ff9933', buildingName:'FACTORY',
    workerLabel:'DRONE', warriorLabel:'GUNBOT',
    workerCost:5,
    buildingColor:'#2a2010',
    barracksName:'BARRACKS', barracksLabel:'BARRACKS',
    warriorCost:6, warriorDesc:'Ranged — rapid fire gun',
    structName:'ARMORY', structLabel:'ARMORY',
    eliteLabel:'SHOCKBOT', eliteDesc:'Ranged — chain lightning hits multiple enemies',
    eliteCost:30, eliteIcon:'⚡',
    elite2Label:'TANK', elite2Desc:'Heavy armored unit — high HP, AOE cannon',
    elite2Cost:25, elite2Icon:'🚗', elite2Fn:'makeTank',
    // UI icons
    workerIcon:'🤖', warriorIcon:'🦾',
    barracksIcon:'🪖', structIcon:'🏭', baseIcon:'🏗',
    cannonColor:'#ffaa00', cannonSound:'rtsCannonFire',
    aerialName:'SHIPYARD', aerialLabel:'SHIPYARD', aerialIcon:'🚀',
    aerialUnitLabel:'SKY ATTACKER', aerialUnitDesc:'Aerial — heavy missiles, immune to melee',
    aerialUnitCost:32, aerialUnitIcon:'🚀', aerialFn:'makeSkyAttacker',
  },
};

// UI/presentation config (reveal screen, card select)
const FACTION_DATA={
  shadow:{ armada:'SHADOW ARMADA', champion:'THE SWORDSMAN', lore:'"From the void between stars, he emerged. None who faced his blade lived to name him."', accentColor:'#9933ff' },
  prism: { armada:'PRISM ARMADA',  champion:'THE WHITE WITCH', lore:'"She speaks in light. Her words become spells. Her spells become storms."', accentColor:'#00ddff' },
  roboto:{ armada:'ROBOTO ARMADA', champion:'THE GUNBOT',     lore:'"Forged in a dead star\'s core. Programmed for one purpose: total suppression."', accentColor:'#ff8800' },
};

// Shared DSO state
let dsoSelectedFaction = null;
let dsoRevealRAF = null;
let dsoRevealFrame = 0;
let dsoPreviewRAF = null;

//# sourceMappingURL=factions.js.map
