// End-to-end test of tests, quizzes and assignments, run against an in-memory
// better-auth instance with the students and classwork plugins.
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = "http://localhost:3000";

async function setup() {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  const { anonymous } = await import("better-auth/plugins");
  const { students } = await import("../lib/students.js");
  const { classwork } = await import("../lib/classwork.js");
  const db = {
    user: [], session: [], account: [], verification: [],
    student: [], studentLoginRequest: [], classworkItem: [], classworkSubmission: [],
  };
  const auth = betterAuth({
    baseURL: BASE,
    secret: "test-secret-test-secret-test-secret-123",
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [classwork(), students(), anonymous()],
  });

  async function call(path, { method = "POST", body, cookie } = {}) {
    const headers = { origin: BASE };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const res = await auth.handler(new Request(BASE + "/api/auth" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }));
    const setCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, cookie: setCookie };
  }

  async function signUp(email) {
    const r = await call("/sign-up/email", { body: { email, password: "password1234", name: email } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.cookie;
  }

  // Adds a student for the educator and signs them in with the educator's OK.
  async function addStudent(teacher, username) {
    await call("/students/add", { cookie: teacher, body: { usernames: [username] } });
    const { json } = await call("/student-login/request", { body: { username } });
    const list = await call("/students/list", { method: "GET", cookie: teacher });
    const rq = list.json.requests.find((x) => x.username === username);
    await call("/students/decide", { cookie: teacher, body: { requestId: rq.id, approve: true } });
    const r = await call("/sign-in/student", { body: { token: json.token } });
    assert.equal(r.json.status, "approved");
    return r.cookie;
  }

  return { db, call, signUp, addStudent };
}

const QUIZ = {
  kind: "quiz",
  title: "Cells quiz",
  dueDate: "2026-12-01",
  questions: [
    { prompt: "Which part holds the DNA?", choices: ["Nucleus", "Cell wall", "Vacuole"], answer: 0 },
    { prompt: "Plant cells have a…", choices: ["Tail", "Cell wall"], answer: 1 },
  ],
};

test("students take quizzes, scored on the server without seeing the key", async () => {
  const { call, signUp, addStudent } = await setup();
  const teacher = await signUp("teacher@example.com");
  const alex = await addStudent(teacher, "alex.k");
  const sam = await addStudent(teacher, "sam_1");

  let r = await call("/classwork/create", { cookie: teacher, body: QUIZ });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const quizId = r.json.item.id;

  // Students see the quiz but not the answers.
  r = await call("/classwork/list", { method: "GET", cookie: alex });
  assert.equal(r.json.role, "student");
  assert.equal(r.json.items.length, 1);
  assert.equal(r.json.items[0].submission, null);
  assert.equal(r.json.items[0].questions[0].answer, undefined);
  assert.deepEqual(r.json.items[0].questions[0].choices, ["Nucleus", "Cell wall", "Vacuole"]);

  // Answers must cover every question.
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: quizId, answers: [0] } });
  assert.equal(r.status, 400);

  r = await call("/classwork/submit", { cookie: alex, body: { itemId: quizId, answers: [0, 0] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.submission.score, 1);
  assert.equal(r.json.submission.total, 2);
  assert.deepEqual(r.json.submission.correct, [true, false]);

  // Only one try.
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: quizId, answers: [0, 1] } });
  assert.equal(r.status, 409);

  r = await call("/classwork/list", { method: "GET", cookie: alex });
  assert.equal(r.json.items[0].submission.score, 1);

  // Educator sees who turned it in.
  r = await call("/classwork/list", { method: "GET", cookie: teacher });
  assert.equal(r.json.role, "educator");
  assert.equal(r.json.studentCount, 2);
  assert.equal(r.json.items[0].turnedIn, 1);
  assert.equal(r.json.items[0].questions[0].answer, 0);

  r = await call("/classwork/submissions", { cookie: teacher, body: { itemId: quizId } });
  assert.deepEqual(r.json.students.map((s) => [s.username, s.submission && s.submission.score]), [["alex.k", 1], ["sam_1", null]]);

  // Students can't create or view others' work.
  r = await call("/classwork/create", { cookie: sam, body: QUIZ });
  assert.equal(r.status, 403);
  r = await call("/classwork/submissions", { cookie: sam, body: { itemId: quizId } });
  assert.equal(r.status, 403);
});

test("students turn in assignments as a written response", async () => {
  const { call, signUp, addStudent } = await setup();
  const teacher = await signUp("teacher@example.com");
  const alex = await addStudent(teacher, "alex.k");

  let r = await call("/classwork/create", { cookie: teacher, body: { kind: "assignment", title: "Draw a cell", notes: "Label 3 parts." } });
  const id = r.json.item.id;

  r = await call("/classwork/submit", { cookie: alex, body: { itemId: id, response: "   " } });
  assert.equal(r.status, 400);
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: id, response: "Nucleus, membrane, mitochondria" } });
  assert.equal(r.status, 200);

  r = await call("/classwork/submissions", { cookie: teacher, body: { itemId: id } });
  assert.equal(r.json.students[0].submission.response, "Nucleus, membrane, mitochondria");

  // Deleting the item removes it and its submissions.
  r = await call("/classwork/delete", { cookie: teacher, body: { itemId: id } });
  assert.equal(r.status, 200);
  r = await call("/classwork/list", { method: "GET", cookie: alex });
  assert.equal(r.json.items.length, 0);
});

test("classwork stays within each educator's class", async () => {
  const { call, signUp, addStudent } = await setup();
  const teacher = await signUp("teacher@example.com");
  const other = await signUp("other@example.com");
  const alex = await addStudent(teacher, "alex.k");

  let r = await call("/classwork/create", { cookie: other, body: { ...QUIZ, kind: "test" } });
  const otherId = r.json.item.id;

  r = await call("/classwork/list", { method: "GET", cookie: alex });
  assert.equal(r.json.items.length, 0);
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: otherId, answers: [0, 1] } });
  assert.equal(r.status, 404);
  r = await call("/classwork/delete", { cookie: teacher, body: { itemId: otherId } });
  assert.equal(r.status, 404);
  r = await call("/classwork/submissions", { cookie: teacher, body: { itemId: otherId } });
  assert.equal(r.status, 404);
});

test("tests and quizzes need valid multiple-choice questions", async () => {
  const { call, signUp } = await setup();
  const teacher = await signUp("teacher@example.com");
  const bad = [
    { kind: "quiz", title: "x" },
    { kind: "quiz", title: "x", questions: [{ prompt: "q", choices: ["only one"], answer: 0 }] },
    { kind: "quiz", title: "x", questions: [{ prompt: "q", choices: ["a", "b"], answer: 2 }] },
    { kind: "quiz", title: "x", questions: [{ prompt: "", choices: ["a", "b"], answer: 0 }] },
    { kind: "homework", title: "x" },
    { kind: "assignment", title: "  " },
  ];
  for (const b of bad) {
    const r = await call("/classwork/create", { cookie: teacher, body: b });
    assert.equal(r.status, 400, JSON.stringify(b));
  }
  const r = await call("/classwork/list", { method: "GET" });
  assert.equal(r.status, 401);
});

test("educators grade and comment on assignments; students see it", async () => {
  const { call, signUp, addStudent } = await setup();
  const teacher = await signUp("teacher@example.com");
  const other = await signUp("other@example.com");
  const alex = await addStudent(teacher, "alex.k");

  let r = await call("/classwork/create", { cookie: teacher, body: { kind: "assignment", title: "Draw a cell" } });
  const id = r.json.item.id;
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: id, response: "My drawing" } });
  const subId = r.json.submission.id;
  assert.equal(r.json.submission.grade, null);

  // Only the educator who set the work can grade it.
  r = await call("/classwork/grade", { cookie: other, body: { submissionId: subId, grade: "A" } });
  assert.equal(r.status, 404);
  r = await call("/classwork/grade", { cookie: alex, body: { submissionId: subId, grade: "A" } });
  assert.equal(r.status, 403);
  r = await call("/classwork/grade", { cookie: teacher, body: { submissionId: subId, grade: "x".repeat(21) } });
  assert.equal(r.status, 400);

  r = await call("/classwork/grade", { cookie: teacher, body: { submissionId: subId, grade: " 9/10 ", comment: "Great labels!" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.submission.grade, "9/10");
  assert.equal(r.json.submission.comment, "Great labels!");

  r = await call("/classwork/list", { method: "GET", cookie: alex });
  assert.equal(r.json.items[0].submission.grade, "9/10");
  assert.equal(r.json.items[0].submission.comment, "Great labels!");

  r = await call("/classwork/list", { method: "GET", cookie: teacher });
  assert.equal(r.json.items[0].graded, 1);
  r = await call("/classwork/submissions", { cookie: teacher, body: { itemId: id } });
  assert.equal(r.json.students[0].submission.comment, "Great labels!");

  // Grades can be changed, or cleared.
  r = await call("/classwork/grade", { cookie: teacher, body: { submissionId: subId, grade: "", comment: "" } });
  assert.equal(r.json.submission.grade, null);
  r = await call("/classwork/list", { method: "GET", cookie: teacher });
  assert.equal(r.json.items[0].graded, 0);

  // Quizzes are scored automatically, not graded by hand.
  r = await call("/classwork/create", { cookie: teacher, body: QUIZ });
  r = await call("/classwork/submit", { cookie: alex, body: { itemId: r.json.item.id, answers: [0, 1] } });
  r = await call("/classwork/grade", { cookie: teacher, body: { submissionId: r.json.submission.id, grade: "A" } });
  assert.equal(r.status, 400);
});
