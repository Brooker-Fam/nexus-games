const test = require('node:test');
const assert = require('node:assert');

test('role change rules', async () => {
  const { canChangeRole, isValidRole } = await import('../lib/roles.js');
  assert.ok(isValidRole('student'));
  assert.ok(!isValidRole('admin'));
  // first pick
  assert.ok(canChangeRole({ current: null, next: 'player', isAnonymous: false }));
  // signed-in students are locked
  assert.ok(!canChangeRole({ current: 'student', next: 'player', isAnonymous: false }));
  assert.ok(!canChangeRole({ current: 'student', next: 'educator', isAnonymous: false }));
  assert.ok(canChangeRole({ current: 'student', next: 'student', isAnonymous: false }));
  // anonymous sessions can still change their mind
  assert.ok(canChangeRole({ current: 'student', next: 'player', isAnonymous: true }));
  // anyone else can switch, including to student
  assert.ok(canChangeRole({ current: 'player', next: 'student', isAnonymous: false }));
  assert.ok(!canChangeRole({ current: 'player', next: 'admin', isAnonymous: false }));
});
