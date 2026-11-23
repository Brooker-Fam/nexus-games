// Tests, quizzes and assignments that educators give to their students.
//
// Educators create items for all of their students. Tests and quizzes are
// multiple-choice and are scored on the server, so students never receive the
// answer key. Assignments are turned in as a written response. Each student
// can turn in each item once.
//
// Endpoints (served under /api/auth):
//   GET  /classwork/list          educator: their items + how many turned in
//                                 student:  their educator's items + own submission
//   POST /classwork/create        educator: { kind, title, dueDate?, notes?, questions? }
//   POST /classwork/delete        educator: { itemId }
//   POST /classwork/submissions   educator: { itemId } -> every student's status
//   POST /classwork/submit        student:  { itemId, answers?: number[], response? }

import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";

export const KINDS = ["test", "quiz", "assignment"];
export const MAX_TITLE = 120;
export const MAX_NOTES = 2000;
export const MAX_RESPONSE = 5000;
export const MAX_QUESTIONS = 50;
export const MAX_CHOICES = 6;
export const MAX_PROMPT = 500;
export const MAX_CHOICE = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function bad(code, status = "BAD_REQUEST") {
  return new APIError(status, { code, message: code });
}

function body(ctx) {
  return ctx.body && typeof ctx.body === "object" ? ctx.body : {};
}

function text(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parseJson(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Validates and cleans the questions of a test or quiz.
// Each question: { prompt, choices: string[2..6], answer: index into choices }.
export function cleanQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) throw bad("questions_required");
  if (input.length > MAX_QUESTIONS) throw bad("too_many_questions");
  return input.map((q) => {
    const prompt = text(q?.prompt, MAX_PROMPT);
    const choices = Array.isArray(q?.choices) ? q.choices.map((c) => text(c, MAX_CHOICE)).filter(Boolean) : [];
    if (!prompt) throw bad("question_prompt_required");
    if (choices.length < 2 || choices.length > MAX_CHOICES) throw bad("question_choices_invalid");
    const answer = q?.answer;
    if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) throw bad("question_answer_invalid");
    return { prompt, choices, answer };
  });
}

// Scores a student's answers. Returns { score, total, correct: boolean[] }.
export function scoreAnswers(questions, answers) {
  const correct = questions.map((q, i) => Array.isArray(answers) && answers[i] === q.answer);
  return { score: correct.filter(Boolean).length, total: questions.length, correct };
}

export const classworkSchema = {
  classworkItem: {
    fields: {
      educatorId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      kind: { type: "string", required: true },
      title: { type: "string", required: true },
      dueDate: { type: "string", required: false },
      notes: { type: "string", required: false },
      questions: { type: "string", required: false },
      createdAt: { type: "date", required: true },
    },
  },
  classworkSubmission: {
    fields: {
      itemId: { type: "string", required: true, references: { model: "classworkItem", field: "id", onDelete: "cascade" } },
      studentId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      educatorId: { type: "string", required: true, references: { model: "user", field: "id", onDelete: "cascade" } },
      answers: { type: "string", required: false },
      response: { type: "string", required: false },
      score: { type: "number", required: false },
      total: { type: "number", required: false },
      submittedAt: { type: "date", required: true },
    },
  },
};

async function whoAmI(ctx) {
  const user = ctx.context.session?.user;
  if (!user || user.isAnonymous) throw bad("sign_in_required", "UNAUTHORIZED");
  const student = await ctx.context.adapter.findOne({ model: "student", where: [{ field: "userId", value: user.id }] });
  return { user, student };
}

async function requireEducator(ctx) {
  const { user, student } = await whoAmI(ctx);
  if (student) throw bad("students_cannot_manage", "FORBIDDEN");
  return user;
}

async function requireStudent(ctx) {
  const { user, student } = await whoAmI(ctx);
  if (!student) throw bad("students_only", "FORBIDDEN");
  return { user, student };
}

function publicItem(row, { withAnswers }) {
  const questions = row.questions ? parseJson(row.questions, []) : [];
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    dueDate: row.dueDate || null,
    notes: row.notes || "",
    questions: questions.map((q) => (withAnswers ? q : { prompt: q.prompt, choices: q.choices })),
    createdAt: row.createdAt,
  };
}

function publicSubmission(row, questions) {
  const answers = row.answers ? parseJson(row.answers, []) : null;
  return {
    id: row.id,
    studentId: row.studentId,
    answers,
    response: row.response || "",
    score: row.score ?? null,
    total: row.total ?? null,
    correct: answers && questions ? scoreAnswers(questions, answers).correct : null,
    submittedAt: row.submittedAt,
  };
}

function sortItems(items) {
  return items.sort((a, b) => {
    const da = a.dueDate || "9999-12-31";
    const db = b.dueDate || "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

export function classwork() {
  return {
    id: "classwork",
    schema: classworkSchema,
    endpoints: {
      listClasswork: createAuthEndpoint("/classwork/list", { method: "GET", use: [sessionMiddleware] }, async (ctx) => {
        const { user, student } = await whoAmI(ctx);
        const adapter = ctx.context.adapter;
        const educatorId = student ? student.educatorId : user.id;
        const rows = await adapter.findMany({ model: "classworkItem", where: [{ field: "educatorId", value: educatorId }] });

        if (student) {
          const subs = await adapter.findMany({ model: "classworkSubmission", where: [{ field: "studentId", value: user.id }] });
          const subByItem = new Map(subs.map((s) => [s.itemId, s]));
          return ctx.json({
            role: "student",
            items: sortItems(rows.map((row) => {
              const sub = subByItem.get(row.id);
              // Once turned in, the student may see which answers were right.
              const item = publicItem(row, { withAnswers: false });
              item.submission = sub ? publicSubmission(sub, parseJson(row.questions || "[]", [])) : null;
              return item;
            })),
          });
        }

        const studentCount = await adapter.count({ model: "student", where: [{ field: "educatorId", value: user.id }] });
        const subs = await adapter.findMany({ model: "classworkSubmission", where: [{ field: "educatorId", value: user.id }] });
        const counts = new Map();
        for (const s of subs) counts.set(s.itemId, (counts.get(s.itemId) || 0) + 1);
        return ctx.json({
          role: "educator",
          studentCount,
          items: sortItems(rows.map((row) => ({ ...publicItem(row, { withAnswers: true }), turnedIn: counts.get(row.id) || 0 }))),
        });
      }),

      createClasswork: createAuthEndpoint("/classwork/create", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const b = body(ctx);
        if (!KINDS.includes(b.kind)) throw bad("kind_invalid");
        const title = text(b.title, MAX_TITLE);
        if (!title) throw bad("title_required");
        const dueDate = typeof b.dueDate === "string" && DATE_RE.test(b.dueDate) ? b.dueDate : null;
        const notes = text(b.notes, MAX_NOTES);
        const questions = b.kind === "assignment" ? null : cleanQuestions(b.questions);
        const row = await ctx.context.adapter.create({
          model: "classworkItem",
          data: {
            educatorId: educator.id,
            kind: b.kind,
            title,
            dueDate,
            notes: notes || null,
            questions: questions ? JSON.stringify(questions) : null,
            createdAt: new Date(),
          },
        });
        return ctx.json({ item: { ...publicItem(row, { withAnswers: true }), turnedIn: 0 } });
      }),

      deleteClasswork: createAuthEndpoint("/classwork/delete", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const itemId = body(ctx).itemId;
        if (typeof itemId !== "string") throw bad("item_id_required");
        const row = await adapter.findOne({ model: "classworkItem", where: [{ field: "id", value: itemId }] });
        if (!row || row.educatorId !== educator.id) throw bad("not_found", "NOT_FOUND");
        await adapter.deleteMany({ model: "classworkSubmission", where: [{ field: "itemId", value: itemId }] });
        await adapter.delete({ model: "classworkItem", where: [{ field: "id", value: itemId }] });
        return ctx.json({ ok: true });
      }),

      listSubmissions: createAuthEndpoint("/classwork/submissions", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const educator = await requireEducator(ctx);
        const adapter = ctx.context.adapter;
        const itemId = body(ctx).itemId;
        if (typeof itemId !== "string") throw bad("item_id_required");
        const row = await adapter.findOne({ model: "classworkItem", where: [{ field: "id", value: itemId }] });
        if (!row || row.educatorId !== educator.id) throw bad("not_found", "NOT_FOUND");
        const questions = row.questions ? parseJson(row.questions, []) : null;
        const roster = await adapter.findMany({
          model: "student",
          where: [{ field: "educatorId", value: educator.id }],
          sortBy: { field: "username", direction: "asc" },
        });
        const subs = await adapter.findMany({ model: "classworkSubmission", where: [{ field: "itemId", value: itemId }] });
        const subByStudent = new Map(subs.map((s) => [s.studentId, s]));
        return ctx.json({
          students: roster.map((s) => {
            const sub = subByStudent.get(s.userId);
            return { id: s.userId, username: s.username, submission: sub ? publicSubmission(sub, questions) : null };
          }),
        });
      }),

      submitClasswork: createAuthEndpoint("/classwork/submit", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        const { user, student } = await requireStudent(ctx);
        const adapter = ctx.context.adapter;
        const b = body(ctx);
        if (typeof b.itemId !== "string") throw bad("item_id_required");
        const row = await adapter.findOne({ model: "classworkItem", where: [{ field: "id", value: b.itemId }] });
        if (!row || row.educatorId !== student.educatorId) throw bad("not_found", "NOT_FOUND");
        const existing = await adapter.findOne({
          model: "classworkSubmission",
          where: [{ field: "itemId", value: row.id }, { field: "studentId", value: user.id }],
        });
        if (existing) throw bad("already_turned_in", "CONFLICT");

        const data = { itemId: row.id, studentId: user.id, educatorId: row.educatorId, submittedAt: new Date() };
        let questions = null;
        if (row.kind === "assignment") {
          const response = text(b.response, MAX_RESPONSE);
          if (!response) throw bad("response_required");
          data.response = response;
        } else {
          questions = parseJson(row.questions || "[]", []);
          const answers = b.answers;
          if (!Array.isArray(answers) || answers.length !== questions.length) throw bad("answers_required");
          if (!answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < questions[i].choices.length)) throw bad("answers_invalid");
          const { score, total } = scoreAnswers(questions, answers);
          Object.assign(data, { answers: JSON.stringify(answers), score, total });
        }
        let sub;
        try {
          sub = await adapter.create({ model: "classworkSubmission", data });
        } catch {
          // Lost a race with a second submit of the same item.
          throw bad("already_turned_in", "CONFLICT");
        }
        return ctx.json({ submission: publicSubmission(sub, questions) });
      }),
    },
  };
}
