// Kitty Games account roles. Shared by api/role.js, api/session.js and middleware.js.
export const ROLES = ["student", "educator", "player"];

export function isValidRole(role) {
  return ROLES.includes(role);
}

// A signed-in student cannot change their own role (otherwise the student
// restriction would be one click away). Anonymous sessions can still change
// it freely, and anyone else can switch between roles, including to student.
export function canChangeRole({ current, next, isAnonymous }) {
  if (!isValidRole(next)) return false;
  if (current === next) return true;
  if (current === "student" && !isAnonymous) return false;
  return true;
}
