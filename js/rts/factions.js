// ── FACTION CONFIG (centralized) ──
// Game mechanics config
const FACTION_CFG={
  prism:{
    color:'#00ddff', accent:'#aaffff', workerColor:'#88ccff',
    warriorColor:'#ffffff', buildingName:'TEMPLE',
    workerLabel:'ACOLYTE', warriorLabel:'WITCH',
    buildingColor:'#c0e8ff',
    barracksName:'PORTAL', barracksLabel:'PORTAL',
    warriorCost:10, warriorDesc:'Ranged — magic projectiles',
    structName:'SHRINE', structLabel:'SHRINE',
    eliteLabel:'ORACLE', eliteDesc:'Ranged — high damage prismatic bolts',
    eliteCost:18, eliteIcon:'🔮',
    elite2Label:'WIZARD', elite2Desc:'Ranged — chain lightning bounces between enemies',
    elite2Cost:14, elite2Icon:'⚡', elite2Fn:'makeWizard',
    // UI icons
    workerIcon:'🧙', warriorIcon:'✨',
    barracksIcon:'🌀', structIcon:'🏛', baseIcon:'🏰',
  },
  shadow:{
    color:'#9922ff', accent:'#dd88ff', workerColor:'#8855cc',
    warriorColor:'#cc88ff', buildingName:'TEMPLE',
    workerLabel:'SHADE', warriorLabel:'SWORDSMAN',
    buildingColor:'#1a0030',
    barracksName:'TRAINING FIELD', barracksLabel:'TRAINING FIELD',
    warriorCost:10, warriorDesc:'Melee — fast sword charge',
    structName:'DARK SHRINE', structLabel:'DARK SHRINE',
    eliteLabel:'DARK WARRIOR', eliteDesc:'Ranged — black magic bolts that chain',
    eliteCost:18, eliteIcon:'🌑',
    elite2Label:'NECROMANCER', elite2Desc:'Raises dead Swordsmen from the battlefield',
    elite2Cost:20, elite2Icon:'💀', elite2Fn:'makeNecromancer',
    // UI icons
    workerIcon:'🥷', warriorIcon:'⚔',
    barracksIcon:'⚔', structIcon:'⚡', baseIcon:'🏰',
  },
  roboto:{
    color:'#ff8800', accent:'#ffcc44', workerColor:'#aa6622',
    warriorColor:'#ff9933', buildingName:'FACTORY',
    workerLabel:'DRONE', warriorLabel:'GUNBOT',
    buildingColor:'#2a2010',
    barracksName:'BARRACKS', barracksLabel:'BARRACKS',
    warriorCost:6, warriorDesc:'Ranged — rapid fire gun',
    structName:'ARMORY', structLabel:'ARMORY',
    eliteLabel:'SHOCKBOT', eliteDesc:'Ranged — chain lightning hits multiple enemies',
    eliteCost:18, eliteIcon:'⚡',
    elite2Label:'TANK', elite2Desc:'Heavy armored unit — high HP, slow range cannon',
    elite2Cost:25, elite2Icon:'🚗', elite2Fn:'makeTank',
    // UI icons
    workerIcon:'🤖', warriorIcon:'🦾',
    barracksIcon:'🪖', structIcon:'🏭', baseIcon:'🏗',
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
