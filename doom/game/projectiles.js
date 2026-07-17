// Projectiles: move along an angle each frame, explode on wall/entity hit
// or TTL expiry. Damage is applied via game.applyDamage so the damage path
// stays unified.

export function createProjectile(spec) {
  return {
    x: spec.x,
    y: spec.y,
    angle: spec.angle,
    speed: spec.speed,
    damage: spec.damage,
    radius: spec.radius ?? 0.15,
    ttl: spec.ttl ?? 4,
    sprite: spec.sprite || 'projectile',
    owner: spec.owner,
    dead: false,
  };
}

export function updateProjectile(p, dt, game) {
  if (p.dead) return;

  p.ttl -= dt;
  if (p.ttl <= 0) { p.dead = true; return; }

  const dx = Math.cos(p.angle) * p.speed * dt;
  const dy = Math.sin(p.angle) * p.speed * dt;
  const nx = p.x + dx, ny = p.y + dy;

  // Wall collision via tile lookup at the moved-to point.
  if (game.level.getTile(Math.floor(nx), Math.floor(ny)) > 0) {
    p.dead = true;
    return;
  }
  p.x = nx; p.y = ny;

  // Entity collision: hostile to the owner only.
  const targets = (p.owner === 'player' || p.owner === game.player)
    ? game.enemies
    : [game.player];
  for (const t of targets) {
    if (!t || t.dead) continue;
    const ex = t.x - p.x, ey = t.y - p.y;
    const rr = (t.radius || 0.3) + p.radius;
    if (ex * ex + ey * ey <= rr * rr) {
      game.applyDamage(t, p.damage, p.owner);
      p.dead = true;
      return;
    }
  }
}
