// The free-trial form: what is saved, who is emailed, and what a bot gets. Runs against the dev
// database in .env and deletes its rows afterwards. No mail leaves the machine: fake SMTP settings
// replace the real ones from .env, and nodemailer's transport records each message instead.
require("dotenv").config({ quiet: true });
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
process.env.MAIL_REPLY_TO = "school@example.test";

const RUN = `trial-test-${Date.now()}`;

const { test, before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");

const sent = [];
mock.method(nodemailer, "createTransport", () => ({
  sendMail: async (message) => {
    sent.push(message);
    return { messageId: `${RUN}-${sent.length}` };
  },
}));

const app = require("../src/app");
const prisma = require("../src/lib/prisma");
const { renderTrialConfirmation } = require("../src/lib/mailer");

let server;
let base;

async function post(body) {
  const res = await fetch(`${base}/trial`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// The emails go out after the response, so give them a moment to arrive.
async function mailCount(n) {
  for (let i = 0; i < 50 && sent.length < n; i++) await new Promise((r) => setTimeout(r, 20));
  return sent.length;
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  await prisma.trialRequest.deleteMany({ where: { email: { startsWith: RUN } } });
  await prisma.$disconnect();
  server.close();
});

test("a trial request is saved, answered, and passed on to the school", async () => {
  const email = `${RUN}-family@example.test`;
  const res = await post({
    studentName: "Jason Example",
    guardian: "Kim Example",
    email,
    phone: "808-555-0100",
    instrument: "Drums",
    goals: "Have You Ever Seen the Rain",
  });
  assert.equal(res.status, 201);
  assert.equal((await prisma.trialRequest.findUnique({ where: { id: res.data.trial.id } })).studentName, "Jason Example");

  assert.equal(await mailCount(2), 2, "one email to the family and one to the school");
  const reply = sent.find((m) => m.to === email);
  assert.match(reply.subject, /trial lesson request/);
  assert.match(reply.text, /^Hi Kim Example,/);
  assert.match(reply.text, /a free drum lesson for Jason Example\./);
  assert.match(reply.text, /still in its testing stage/);
  assert.match(reply.text, /fully live by the start of 2027/);
  assert.match(reply.text, /within the next month or two/);
  assert.equal(reply.replyTo, "school@example.test", "the family's answer reaches the school");
  assert.ok(!reply.text.includes("Have You Ever Seen the Rain"), "free text stays out of the reply");

  const notice = sent.find((m) => m.to === "school@example.test");
  assert.equal(notice.replyTo, email, "answering the notice goes straight to the family");
  assert.equal(notice.subject, "New trial request: Jason Example");
  for (const value of ["Kim Example", email, "808-555-0100", "Drums", "Have You Ever Seen the Rain"]) {
    assert.ok(notice.text.includes(value), value);
  }
});

test("the reply carries no HTML, line breaks or outside words from the form", () => {
  const mail = renderTrialConfirmation({
    studentName: '<img src=x onerror="alert(1)">\r\nBcc: someone@example.test',
    guardian: "",
    instrument: "Buy now at spam.example",
  });
  assert.ok(!mail.html.includes("<img"), "names are escaped");
  assert.equal(mail.text.split("\n\n")[0], 'Hi <img src=x onerror="alert(1)"> Bcc: someone@example.test,', "a name stays on one line");
  assert.ok(!mail.text.includes("spam.example"), "an instrument from outside the list is dropped");
  assert.match(mail.text, /about a free trial lesson\./);
});

test("a bot that fills in the hidden field is thanked, and nothing is kept or sent", async () => {
  const count = sent.length;
  const res = await post({ studentName: "Bot", email: `${RUN}-bot@example.test`, website: "https://spam.example" });
  assert.equal(res.status, 201);
  assert.equal(await prisma.trialRequest.count({ where: { email: `${RUN}-bot@example.test` } }), 0);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(sent.length, count, "no email");
});

test("one connection can't send a stream of requests", async () => {
  let res;
  for (let i = 0; i < 10; i++) {
    res = await post({ studentName: "Bot", email: `${RUN}-burst@example.test`, website: "https://spam.example" });
    if (res.status === 429) break;
  }
  assert.equal(res.status, 429);
  assert.match(res.data.error, /Too many requests/);
});
