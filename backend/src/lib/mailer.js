// Outbound email. No provider is wired up yet, so messages are written to the
// server log instead of being sent — enough to click through the verification
// link in development.
//
// To send for real, add a provider here (Resend/SendGrid/SMTP via nodemailer)
// and have it take over when its credentials are present. Everything else calls
// sendMail() and doesn't care which path ran.
const EMAIL_CONFIGURED = false;

async function sendMail({ to, subject, text }) {
  if (!EMAIL_CONFIGURED) {
    console.log(
      [
        "",
        "──────────────────────────────────────────────────────────",
        " EMAIL NOT CONFIGURED — logging instead of sending",
        ` To:      ${to}`,
        ` Subject: ${subject}`,
        "",
        text,
        "──────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { delivered: false, logged: true };
  }

  throw new Error("No email provider configured.");
}

function verificationEmail({ to, link }) {
  return sendMail({
    to,
    subject: "Confirm your email — Rock Works School of Music",
    text: [
      "Welcome to Rock Works!",
      "",
      "Confirm your email address to finish signing up:",
      link,
      "",
      "The link is good for 24 hours. If you didn't sign up, ignore this email.",
    ].join("\n"),
  });
}

module.exports = { sendMail, verificationEmail, EMAIL_CONFIGURED };
