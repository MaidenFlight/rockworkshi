// Checks the SMTP settings in .env and sends a test message.
//
//   npm run mail:check -- you@example.com
//
// Reports whether the credentials are accepted before you go through a whole
// signup or reset to find out. Never prints the password.
require("dotenv").config();
const nodemailer = require("nodemailer");
const { verificationEmail } = require("../src/lib/mailer");

const to = process.argv[2];

function mask(value) {
  if (!value) return "(not set)";
  return `${value.slice(0, 2)}${"•".repeat(Math.max(value.length - 2, 0))}`;
}

async function main() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log("SMTP settings");
  console.log(`  host      ${host || "(not set)"}`);
  console.log(`  port      ${port}`);
  console.log(`  user      ${user || "(not set)"}`);
  console.log(`  pass      ${mask(pass)}`);
  console.log(`  from      ${process.env.MAIL_FROM || "(default)"}`);
  console.log(`  reply-to  ${process.env.MAIL_REPLY_TO ?? "(default)"}`);
  console.log("");

  if (!host || !user || !pass) {
    console.log("No SMTP configured — mail goes to a disposable Ethereal inbox in development.");
    console.log("Set SMTP_HOST, SMTP_USER and SMTP_PASS in backend/.env to send for real.");
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  process.stdout.write("Connecting… ");
  await transport.verify();
  console.log("credentials accepted.");

  if (!to) {
    console.log("\nPass an address to send a test message:");
    console.log("  npm run mail:check -- you@example.com");
    return;
  }

  process.stdout.write(`Sending a sample verification email to ${to}… `);
  await verificationEmail({ to, link: "https://example.com/verify-email?token=sample" });
  console.log("sent. Check that inbox (and the spam folder).");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (/Invalid login|535|BadCredentials/i.test(err.message)) {
    console.error(
      "\nGmail rejects normal account passwords. SMTP_PASS must be a 16-character\n" +
        "App Password from https://myaccount.google.com/apppasswords (needs 2-Step\n" +
        "Verification switched on first)."
    );
  }
  process.exit(1);
});
