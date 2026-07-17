// Pickups: collide-to-collect items.

import { PICKUPS, SCORE } from './config.js';
import { healPlayer, addArmor, addAmmo, giveWeapon, setMessage } from './player.js';

export function createPickup(typeId, x, y) {
  const def = PICKUPS[typeId];
  if (!def) throw new Error('Unknown pickup type: ' + typeId);
  return {
    type: typeId,
    def,
    x, y,
    radius: 0.4,
    sprite: def.sprite,
    consumed: false,
  };
}

export function tryCollect(player, pickup) {
  if (pickup.consumed) return false;
  const def = pickup.def;
  let took = false;

  switch (def.kind) {
    case 'health':
      took = healPlayer(player, def.amount, def.max);
      break;
    case 'armor':
      took = addArmor(player, def.amount, def.max);
      break;
    case 'ammo':
      took = addAmmo(player, def.ammoType, def.amount);
      break;
    case 'weapon': {
      const newWeapon = giveWeapon(player, def.weapon);
      const tookAmmo = def.giveAmmo
        ? addAmmo(player, ammoTypeFor(def.weapon), def.giveAmmo)
        : false;
      took = newWeapon || tookAmmo;
      break;
    }
  }

  if (took) {
    pickup.consumed = true;
    player.score += SCORE.pickup;
    setMessage(player, def.message);
  }
  return took;
}

function ammoTypeFor(weaponId) {
  // Lazy import to avoid cycle — config is cheap.
  // We could also pass it in; map by hand here since it's tiny.
  switch (weaponId) {
    case 'shotgun': return 'shells';
    case 'chaingun': return 'bullets';
    case 'pistol': return 'bullets';
    default: return 'bullets';
  }
}

export function updatePickups(game) {
  const p = game.player;
  if (!p || p.dead) return;
  const r = p.radius;
  for (const pickup of game.pickups) {
    if (pickup.consumed) continue;
    const dx = pickup.x - p.x, dy = pickup.y - p.y;
    const reach = r + pickup.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      tryCollect(p, pickup);
    }
  }
}
