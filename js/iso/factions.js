// ════════════════════════════════════════════════════
//  CITADEL OPS — FACTION CONFIG (2.5D)
// ════════════════════════════════════════════════════
//
// Mirrors the colors and lore in docs/rts-2d-theme.md §1–2 and the
// existing FACTION_CFG in Deep Space Ops. We only carry the fields the
// 2.5D battlefield needs (primary color, accent, worker/warrior tints,
// building palette, naming). Anything tied to the 1D RTS — projectile
// sounds, sky attacker config, etc. — is intentionally omitted.

const ISO_FACTIONS = Object.freeze({
  shadow: {
    id:           'shadow',
    armada:       'SHADOW ARMADA',
    champion:     'THE SWORDSMAN',
    color:        '#9922ff',
    accent:       '#dd88ff',
    workerColor:  '#cc88ff',
    warriorColor: '#ffaaff',
    buildingFill: '#240a3a',
    buildingEdge: '#9922ff',
    glow:         'rgba(153,34,255,0.45)',
    workerLabel:  'SHADE',
    warriorLabel: 'SWORDSMAN',
    hqLabel:      'CITADEL',
    barracksLabel:'TRAINING FIELD',
    techLabel:    'DARK SHRINE',
  },
  prism: {
    id:           'prism',
    armada:       'PRISM ARMADA',
    champion:     'THE WHITE WITCH',
    color:        '#00ddff',
    accent:       '#aaffff',
    workerColor:  '#88ccff',
    warriorColor: '#ffffff',
    buildingFill: '#062a3a',
    buildingEdge: '#00ddff',
    glow:         'rgba(0,221,255,0.45)',
    workerLabel:  'ACOLYTE',
    warriorLabel: 'WITCH',
    hqLabel:      'TEMPLE',
    barracksLabel:'PORTAL',
    techLabel:    'SHRINE',
  },
  roboto: {
    id:           'roboto',
    armada:       'ROBOTO ARMADA',
    champion:     'THE GUNBOT',
    color:        '#ff8800',
    accent:       '#ffcc44',
    workerColor:  '#aa6622',
    warriorColor: '#ff9933',
    buildingFill: '#2a1a06',
    buildingEdge: '#ff8800',
    glow:         'rgba(255,136,0,0.45)',
    workerLabel:  'DRONE',
    warriorLabel: 'GUNBOT',
    hqLabel:      'COMMAND',
    barracksLabel:'BARRACKS',
    techLabel:    'ARMORY',
  },
});

window.ISO_FACTIONS = ISO_FACTIONS;
