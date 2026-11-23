// Kitty Games account roles. Shared by api/role.js, api/session.js and middleware.js.
export const ROLES = ["student", "educator", "player"];

export function isValidRole(role) {
  return ROLES.includes(role);
}

// Who may pick which role:
// - Student accounts (added by an educator, signed in by username) are always
//   students; otherwise the student restriction would be one click away.
// - Guests (anonymous sessions) can pick anything while choosing on screen.
// - Every other signed-in account (Google, email link, passkey) can be an
//   educator or a player, but never a student: "student" there would hide the
//   games and lock the account with no way back to Educator.
export function canChangeRole({ next, isAnonymous, isStudentAccount }) {
  if (!isValidRole(next)) return false;
  if (isStudentAccount) return next === "student";
  if (isAnonymous) return true;
  return next !== "student";
}

// The role an account effectively has, given what is stored on it.
export function effectiveRole({ stored, isAnonymous, isStudentAccount }) {
  if (isStudentAccount) return "student";
  if (!isValidRole(stored)) return null;
  if (stored === "student" && !isAnonymous) return null;
  return stored;
}
