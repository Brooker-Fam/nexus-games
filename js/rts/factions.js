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
    warrior2Label:'LEGIONNAIRES', warrior2Desc:'Melee — sword squad, trained four at a time',
    warrior2Cost:34, warrior2Icon:'🗡', warrior2Fn:'makeLegionnaireSquad', warrior2Count:4,
    structName:'SHRINE', structLabel:'SHRINE',
    eliteLabel:'PRINCESS', eliteDesc:'Unique royal summoner — conjures Legionnaires while engaging enemies (limit 1)',
    eliteCost:200, eliteOilCost:75, eliteIcon:'👸',
    elite2Label:'WIZARD', elite2Desc:'Ranged — chain lightning bounces between enemies',
    elite2Cost:18, elite2Icon:'⚡', elite2Fn:'makeWizard',
    // UI icons
    workerIcon:'🧙', warriorIcon:'✨',
    barracksIcon:'🌀', structIcon:'🏛', baseIcon:'🏰',
    cannonColor:'#00f5ff', cannonSound:'rtsPrismCannon',
    aerialName:'WARP CONDUIT', aerialLabel:'WARP CONDUIT', aerialIcon:'🌀',
    aerialUnitLabel:'WAR DRONE', aerialUnitDesc:'Aerial — fast energy bolts, immune to melee',
    aerialUnitCost:22, aerialUnitIcon:'✦', aerialFn:'makeStarFighter', aerialOilCost:8,
    aerial2Label:'LIGHT FIGHTER', aerial2Desc:'Aerial — fires a piercing beam of light',
    aerial2Cost:28, aerial2Icon:'☀', aerial2Fn:'makeLightFighter', aerial2OilCost:14,
    oilRigName:'ALTAR', oilRigLabel:'ALTAR', oilRigIcon:'⛩',
    oilResourceName:'LIGHT', oilResourceIcon:'🌟',
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
    eliteCost:20, eliteIcon:'🌑', eliteOilCost:25,
    elite2Label:'NECROMANCER', elite2Desc:'Raises dead Swordsmen — fast revive, strong damage',
    elite2Cost:15, elite2Icon:'💀', elite2Fn:'makeNecromancer', elite2OilCost:20,
    // UI icons
    workerIcon:'🥷', warriorIcon:'⚔',
    barracksIcon:'⚔', structIcon:'⚡', baseIcon:'🏰',
    cannonColor:'#cc44ff', cannonSound:'rtsShadowCannon',
    aerialName:'WARP CONDUIT', aerialLabel:'WARP CONDUIT', aerialIcon:'🌀',
    aerialUnitLabel:'WAR DRONE', aerialUnitDesc:'Aerial — fast energy bolts, immune to melee',
    aerialUnitCost:22, aerialUnitIcon:'✦', aerialFn:'makeStarFighter', aerialOilCost:8,
    aerial2Label:'DESTROYER', aerial2Desc:'Aerial — hurls slow orbs of darkness that damage an area',
    aerial2Cost:34, aerial2Icon:'🌌', aerial2Fn:'makeDestroyer', aerial2OilCost:18,
    oilRigName:'GARDEN', oilRigLabel:'GARDEN', oilRigIcon:'🌺',
    oilResourceName:'ESSENCE', oilResourceIcon:'💜',
  },
  roboto:{
    color:'#ff8800', accent:'#ffcc44', workerColor:'#aa6622',
    warriorColor:'#ff9933', buildingName:'FACTORY',
    workerLabel:'DRONE', warriorLabel:'GUNBOT',
    workerCost:5,
    buildingColor:'#2a2010',
    barracksName:'BARRACKS', barracksLabel:'BARRACKS',
    warriorCost:6, warriorDesc:'Ranged — rapid fire gun',
    warrior2Label:'WARBOT', warrior2Desc:'Ranged — heavier armor, harder-hitting rifle than GunBot',
    warrior2Cost:14, warrior2Icon:'🦿', warrior2Fn:'makeWarbot',
    structName:'ARMORY', structLabel:'ARMORY',
    eliteLabel:'SHOCKBOT', eliteDesc:'Ranged — chain lightning hits multiple enemies',
    eliteCost:24, eliteIcon:'⚡',
    elite2Label:'TANK', elite2Desc:'Heavy armored unit — high HP, AOE cannon',
    elite2Cost:25, elite2Icon:'🚗', elite2Fn:'makeTank', tankOilCost:12,
    // UI icons
    workerIcon:'🤖', warriorIcon:'🦾',
    barracksIcon:'🪖', structIcon:'🏭', baseIcon:'🏗',
    cannonColor:'#ffaa00', cannonSound:'rtsCannonFire',
    aerialName:'SHIPYARD', aerialLabel:'SHIPYARD', aerialIcon:'🚀',
    aerialUnitLabel:'WAR DRONE', aerialUnitDesc:'Aerial — heavy missiles, immune to melee',
    aerialUnitCost:22, aerialUnitIcon:'🚀', aerialFn:'makeSkyAttacker', aerialOilCost:8,
    aerial2Label:'WARSHIP', aerial2Desc:'Aerial — switches between single-target and multi-target fire',
    aerial2Cost:60, aerial2Icon:'🚀', aerial2Fn:'makeWarship', aerial2OilCost:30,
    oilRigName:'OIL RIG', oilRigLabel:'OIL RIG', oilRigIcon:'🛢',
  },
};

// UI/presentation config (reveal screen, card select)
const FACTION_DATA={
  shadow:{ armada:'SHADOW ARMADA', champion:'THE SWORDSMAN', lore:'"From the void between stars, he emerged. None who faced his blade lived to name him."', accentColor:'#9933ff', progression:{} },
  prism: { armada:'PRISM ARMADA',  champion:'THE WHITE WITCH', lore:'"She speaks in light. Her words become spells. Her spells become storms."', accentColor:'#00ddff', progression:{} },
  roboto:{ armada:'ROBOTO ARMADA', champion:'THE GUNBOT',     lore:'"Forged in a dead star\'s core. Programmed for one purpose: total suppression."', accentColor:'#ff8800', progression:{} },
};

// Shared DSO state
let dsoSelectedFaction = null;
let dsoRevealRAF = null;
let dsoRevealFrame = 0;
let dsoPreviewRAF = null;

//# sourceMappingURL=factions.js.map
