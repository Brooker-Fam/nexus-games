// ── HOMESTEAD WARS — FACTION CONFIG (centralized) ──
// Game mechanics config
const HW_FACTIONS={
  barnyard:{
    color:'#cc4422', accent:'#ff8866', workerColor:'#aa6644',
    warriorColor:'#ff6644', buildingName:'FARMHOUSE',
    workerLabel:'FARMHAND', warriorLabel:'ROOSTER',
    workerCost:5,
    buildingColor:'#3a2010',
    barracksName:'BARNYARD', barracksLabel:'BARNYARD',
    warriorCost:10, warriorDesc:'Melee — fast pecking charge',
    structName:'PADDOCK', structLabel:'PADDOCK',
    eliteLabel:'RAM', eliteDesc:'Ranged — charging bolts that pierce',
    eliteCost:30, eliteIcon:'\ud83d\udc0f',
    elite2Label:'BULL', elite2Desc:'Heavy armored unit — high HP, AOE cannon',
    elite2Cost:25, elite2Icon:'\ud83d\udc02', elite2Fn:'hwMakeRam',
    // UI icons
    workerIcon:'\ud83e\uddd1\u200d\ud83c\udf3e', warriorIcon:'\ud83d\udc13',
    barracksIcon:'\ud83c\udf3e', structIcon:'\ud83c\udff0', baseIcon:'\ud83c\udfe0',
    cannonColor:'#cc4422', cannonSound:'hwBarnyardCannon',
  },
  creek:{
    color:'#2299bb', accent:'#88ddff', workerColor:'#66aacc',
    warriorColor:'#aaddff', buildingName:'FARMHOUSE',
    workerLabel:'DUCKLING', warriorLabel:'GOOSE',
    workerCost:5,
    buildingColor:'#102a30',
    barracksName:'COOP', barracksLabel:'COOP',
    warriorCost:10, warriorDesc:'Ranged — honk projectiles',
    structName:'ROOKERY', structLabel:'ROOKERY',
    eliteLabel:'SWAN', eliteDesc:'Ranged — high damage prismatic bolts',
    eliteCost:30, eliteIcon:'\ud83e\udda2',
    elite2Label:'PELICAN', elite2Desc:'Ranged — chain splash bounces between enemies',
    elite2Cost:18, elite2Icon:'\ud83d\udc26', elite2Fn:'hwMakePelican',
    // UI icons
    workerIcon:'\ud83d\udc25', warriorIcon:'\ud83e\udea8',
    barracksIcon:'\ud83d\udc14', structIcon:'\ud83c\udfda\ufe0f', baseIcon:'\ud83c\udfe0',
    cannonColor:'#2299bb', cannonSound:'hwCreekCannon',
  },
  woodland:{
    color:'#66aa22', accent:'#aadd66', workerColor:'#88aa44',
    warriorColor:'#aacc66', buildingName:'FARMHOUSE',
    workerLabel:'SQUIRREL', warriorLabel:'OWL',
    workerCost:5,
    buildingColor:'#1a2a10',
    barracksName:'PERCH', barracksLabel:'PERCH',
    warriorCost:6, warriorDesc:'Ranged — rapid fire hoot',
    structName:'DEN', structLabel:'DEN',
    eliteLabel:'HAWK', eliteDesc:'Ranged — chain attack hits multiple enemies',
    eliteCost:30, eliteIcon:'\ud83e\udd85',
    elite2Label:'BEAR', elite2Desc:'Heavy armored unit — high HP, AOE cannon',
    elite2Cost:25, elite2Icon:'\ud83d\udc3b', elite2Fn:'hwMakeBear',
    // UI icons
    workerIcon:'\ud83d\udc3f\ufe0f', warriorIcon:'\ud83e\udd89',
    barracksIcon:'\ud83e\udeb9', structIcon:'\ud83c\udfda\ufe0f', baseIcon:'\ud83c\udfe0',
    cannonColor:'#66aa22', cannonSound:'hwWoodlandCannon',
  },
};

// UI/presentation config (reveal screen, card select)
const HW_FACTION_DATA={
  barnyard:{ armada:'BARNYARD HERD', champion:'THE ROOSTER KING', lore:'"Born in the dust of the old barn, he crows at dawn and charges at dusk. None outrun his spur."', accentColor:'#cc4422' },
  creek:  { armada:'CREEK HERD',   champion:'MOTHER GOOSE',   lore:'"From the mist of the creek she rises. Her honk echoes across the valley. Her wings bring the storm."', accentColor:'#2299bb' },
  woodland:{ armada:'WOODLAND HERD', champion:'THE GREAT OWL',     lore:'"Silent wings in the canopy. Eyes that see through darkness. Talons that never miss."', accentColor:'#66aa22' },
};

// Shared HW state
let hwSelectedFaction = null;
let hwRevealRAF = null;
let hwRevealFrame = 0;
let hwPreviewRAF = null;
