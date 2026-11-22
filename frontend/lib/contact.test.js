import test from "node:test";
import assert from "node:assert/strict";
import { REASONS, accountDetails, messagePrompt, withAccount } from "./contact.js";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const blank = { name: "", email: "", phone: "", reason: REASONS[0], message: "" };
const untouched = { name: false, email: false };

test("the reasons are the four the API has always stored, in order", () => {
  assert.deepEqual(REASONS, ["General question", "Billing", "Scheduling", "Other"]);
});

test("the message box asks a question that fits the reason", () => {
  assert.equal(messagePrompt("General question"), "How can we help?");
  assert.equal(messagePrompt("Billing"), "Tell us what you need help with regarding your membership.");
  assert.equal(messagePrompt("Scheduling"), "Tell us about your scheduling question.");
  assert.equal(messagePrompt("Other"), "How can we help?");
  assert.equal(messagePrompt(undefined), "How can we help?");
});

test("a signed-in account offers its name and email, trimmed", () => {
  const user = { id: 7, name: "  Kai Nakamura ", email: " kai@example.test ", phone: "808 555 0142" };
  assert.deepEqual(accountDetails(user, isEmail), { name: "Kai Nakamura", email: "kai@example.test" });
});

test("nobody signed in, or a demo student, offers nothing", () => {
  assert.deepEqual(accountDetails(null, isEmail), { name: "", email: "" });
  assert.deepEqual(accountDetails(undefined, isEmail), { name: "", email: "" });
  const demo = { id: 9, name: "Demo Student", email: "guitar-1@student-demo.invalid", isDemo: true };
  assert.deepEqual(accountDetails(demo, isEmail), { name: "", email: "" });
});

test("only details that would pass the form's own checks are offered", () => {
  assert.deepEqual(accountDetails({ id: 1, name: null, email: "kai@example.test" }, isEmail), { name: "", email: "kai@example.test" });
  assert.deepEqual(accountDetails({ id: 1, name: "Kai", email: "kai@nowhere" }, isEmail), { name: "Kai", email: "" });
  assert.deepEqual(accountDetails({ id: 1, name: "K".repeat(121), email: `${"k".repeat(250)}@a.io` }, isEmail), { name: "", email: "" });
  assert.deepEqual(accountDetails({ id: 1, name: 42, email: {} }, isEmail), { name: "", email: "" });
});

test("the account stands in for name and email until the visitor types in that field", () => {
  const account = { name: "Kai Nakamura", email: "kai@example.test" };
  assert.deepEqual(withAccount(blank, untouched, account), { ...blank, ...account });

  const renamed = { ...blank, name: "Kai N." };
  assert.deepEqual(withAccount(renamed, { name: true, email: false }, account), { ...blank, name: "Kai N.", email: "kai@example.test" });
});

test("a field the visitor cleared stays empty", () => {
  const account = { name: "Kai Nakamura", email: "kai@example.test" };
  assert.equal(withAccount(blank, { name: false, email: true }, account).email, "");
});

test("signing out, or another account signing in, replaces only what was never typed", () => {
  const typed = { name: true, email: false };
  const form = { ...blank, name: "Someone Else" };
  assert.deepEqual(withAccount(form, typed, { name: "", email: "" }), { ...blank, name: "Someone Else", email: "" });
  assert.deepEqual(withAccount(form, typed, { name: "Mia Tanaka", email: "mia@example.test" }), {
    ...blank,
    name: "Someone Else",
    email: "mia@example.test",
  });
});

test("the rest of the form is left as it was", () => {
  const form = { name: "", email: "", phone: "808 555 0142", reason: "Billing", message: "About my plan" };
  const out = withAccount(form, untouched, { name: "Kai", email: "kai@example.test" });
  assert.equal(out.phone, "808 555 0142");
  assert.equal(out.reason, "Billing");
  assert.equal(out.message, "About my plan");
});
