// The contact form's rules, kept out of React so they can be tested on their own.

// Stored as they are and listed in Admin → Messages, so the words are not casually changed.
export const REASONS = ["General question", "Billing", "Scheduling", "Other"];

const PROMPTS = {
  Billing: "Tell us what you need help with regarding your membership.",
  Scheduling: "Tell us about your scheduling question.",
};

const DEFAULT_PROMPT = "How can we help?";

// What the empty message box asks, by reason. Only ever a placeholder, so choosing another reason
// can never replace what someone has typed.
export function messagePrompt(reason) {
  return PROMPTS[reason] || DEFAULT_PROMPT;
}

const NOBODY = Object.freeze({ name: "", email: "" });

// The name and email worth offering from a signed-in account, each only if it would pass the form's
// own checks. A demo student has neither: its address is made up, and the API refuses to send for it.
export function accountDetails(user, isEmail) {
  if (!user || user.isDemo) return NOBODY;
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  return {
    name: name.length <= 120 ? name : "",
    email: email.length <= 254 && isEmail(email) ? email : "",
  };
}

// What the form shows and sends. The account's name and email stand in until the visitor types in
// that field and never after, and they go again when the account does (signing out).
export function withAccount(form, typed, account) {
  return {
    ...form,
    name: typed.name ? form.name : account.name,
    email: typed.email ? form.email : account.email,
  };
}
