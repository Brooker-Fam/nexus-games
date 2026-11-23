const test = require('node:test');
const assert = require('node:assert');

test('role change rules', async () => {
  const { canChangeRole, isValidRole } = await import('../lib/roles.js');
  assert.ok(isValidRole('student'));
  assert.ok(!isValidRole('admin'));
  // signed-in student accounts are locked
  assert.ok(!canChangeRole({ next: 'player', isAnonymous: false, isStudentAccount: true }));
  assert.ok(!canChangeRole({ next: 'educator', isAnonymous: false, isStudentAccount: true }));
  assert.ok(canChangeRole({ next: 'student', isAnonymous: false, isStudentAccount: true }));
  // guests can change their mind freely
  assert.ok(canChangeRole({ next: 'student', isAnonymous: true, isStudentAccount: false }));
  assert.ok(canChangeRole({ next: 'educator', isAnonymous: true, isStudentAccount: false }));
  // real (non-student) accounts can always become educators, never students
  assert.ok(canChangeRole({ next: 'educator', isAnonymous: false, isStudentAccount: false }));
  assert.ok(canChangeRole({ next: 'player', isAnonymous: false, isStudentAccount: false }));
  assert.ok(!canChangeRole({ next: 'student', isAnonymous: false, isStudentAccount: false }));
  assert.ok(!canChangeRole({ next: 'admin', isAnonymous: false, isStudentAccount: false }));
});

test('effective role', async () => {
  const { effectiveRole } = await import('../lib/roles.js');
  // an educator whose account was left saying "student" is not stuck as one
  assert.strictEqual(effectiveRole({ stored: 'student', isAnonymous: false, isStudentAccount: false }), null);
  assert.strictEqual(effectiveRole({ stored: 'educator', isAnonymous: false, isStudentAccount: false }), 'educator');
  assert.strictEqual(effectiveRole({ stored: 'student', isAnonymous: true, isStudentAccount: false }), 'student');
  assert.strictEqual(effectiveRole({ stored: null, isAnonymous: false, isStudentAccount: true }), 'student');
  assert.strictEqual(effectiveRole({ stored: 'educator', isAnonymous: false, isStudentAccount: true }), 'student');
});
