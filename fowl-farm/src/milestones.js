// Flock-size milestones. Pure UI/data helpers.

export const FLOCK_MILESTONES = [5, 10, 25, 50, 100];

export function milestoneStatus(state) {
  const flock = state.birds.length;
  return FLOCK_MILESTONES.map((target) => ({
    target,
    reached: flock >= target,
  }));
}

export function nextMilestone(state) {
  const flock = state.birds.length;
  return FLOCK_MILESTONES.find((m) => flock < m) || null;
}
