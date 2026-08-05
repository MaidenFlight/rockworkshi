const nodemailer = require("nodemailer");

// Outbound email over SMTP, which every provider speaks — Gmail, Resend,
// SendGrid, Mailgun, Postmark — so switching is a config change, not a rewrite.
// See .env.example for the settings.
//
// With nothing configured, development falls back to an Ethereal mailbox: a
// disposable inbox nodemailer provisions on demand. The message is genuinely
// sent and rendered, and the log prints a URL to view it — much closer to the
// real thing than printing the body to a terminal. Nothing reaches a real
// address that way, so production refuses to start a fallback and reports the
// misconfiguration instead.
// Resend will send from any address on the verified domain, whether or not a
// mailbox exists there — so this is deliberately the one that does exist, to
// keep every address a reader sees pointing at a real inbox.
const FROM =
  process.env.MAIL_FROM ||
  "Rock Works School of Music <denny.landika@rockworksschoolofmusichawaii.com>";
// Verifying a sending domain does not create a mailbox on it, so an address in
// FROM can send while nothing receives there — someone hitting Reply would get a
// bounce. Setting this explicitly keeps replies working even if FROM later moves
// to an address that only sends. Set MAIL_REPLY_TO to an empty string to send no
// Reply-To at all, and the copy below drops its "contact us" clause rather than
// printing a dead address.
const REPLY_TO =
  process.env.MAIL_REPLY_TO ?? "denny.landika@rockworksschoolofmusichawaii.com";
const SMTP_HOST = process.env.SMTP_HOST;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

let transportPromise = null;

function smtpConfigured() {
  return Boolean(SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function buildTransport() {
  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      // 465 is implicit TLS; 587 and 25 upgrade with STARTTLS.
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Fail fast when the port is unreachable. Nodemailer's defaults are two
      // minutes to connect and ten of socket inactivity, and a host that drops
      // SMTP packets rather than refusing them burns the whole budget: signup
      // awaits this send, so the person watches a spinner for minutes before
      // the error is logged and the request finally completes. Some hosts block
      // outbound 587 outright — Render does — so this is a configuration
      // mistake worth surfacing in seconds.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return { transport, kind: "smtp" };
  }

  if (IS_PRODUCTION) {
    throw new Error(
      "No SMTP configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send email."
    );
  }

  const test = await nodemailer.createTestAccount();
  const transport = nodemailer.createTransport({
    host: test.smtp.host,
    port: test.smtp.port,
    secure: test.smtp.secure,
    auth: { user: test.user, pass: test.pass },
  });
  return { transport, kind: "ethereal" };
}

function getTransport() {
  // Built once and reused; a failure isn't cached, so fixing the config and
  // retrying works without a restart.
  if (!transportPromise) {
    transportPromise = buildTransport().catch((err) => {
      transportPromise = null;
      throw err;
    });
  }
  return transportPromise;
}

async function sendMail({ to, subject, text, html }) {
  const { transport, kind } = await getTransport();
  const info = await transport.sendMail({
    from: FROM,
    ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    to,
    subject,
    text,
    html,
  });

  if (kind === "ethereal") {
    const preview = nodemailer.getTestMessageUrl(info);
    console.log(
      [
        "",
        "──────────────────────────────────────────────────────────",
        " Sent to a disposable Ethereal inbox (no SMTP configured).",
        ` To:      ${to}`,
        ` Subject: ${subject}`,
        ` View it: ${preview}`,
        "──────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return { delivered: true, preview, kind };
  }

  console.log(`Email sent to ${to} (${subject})`);
  return { delivered: true, kind };
}

function layout({ heading, lines, button, footer }) {
  // Inline styles and a table shell: email clients strip <style> blocks and
  // have patchy flexbox support.
  const body = lines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#33454f;">${line}</p>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fbf5ec;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf5ec;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf9;border:1px solid #ece0d5;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#06192d,#0b3a4c 70%,#0e5561);padding:28px 32px;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;">Rock Works</div>
                <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#7fd3dd;margin-top:4px;">School of Music</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#0a2338;">${heading}</h1>
                ${body}
                ${
                  button
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                         <tr><td style="border-radius:999px;background:#ef5130;">
                           <a href="${button.href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${button.label}</a>
                         </td></tr>
                       </table>
                       <p style="margin:16px 0 0;font-size:12.5px;line-height:1.55;color:#8a7d6a;">If the button doesn't work, paste this into your browser:<br><a href="${button.href}" style="color:#0e8a97;word-break:break-all;">${button.href}</a></p>`
                    : ""
                }
                ${
                  footer
                    ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #ece0d5;font-size:12.5px;line-height:1.55;color:#a3927f;">${footer}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
          <div style="max-width:520px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11.5px;color:#a3927f;">
            Rock Works School of Music &middot; Honolulu, Hawaii &middot; Est. 1982
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function verificationEmail({ to, link }) {
  return sendMail({
    to,
    subject: "Confirm your email — Rock Works School of Music",
    // Plain-text alternative, for clients that don't render HTML.
    text: [
      "Welcome to Rock Works!",
      "",
      "Confirm your email address to finish signing up:",
      link,
      "",
      "The link is good for 24 hours. If you didn't sign up, ignore this email.",
    ].join("\n"),
    html: layout({
      heading: "Confirm your email",
      lines: [
        "Welcome to Rock Works! You're one click away from finishing your sign-up.",
        "Confirm your email address and we'll take you through to choosing your plan.",
      ],
      button: { href: link, label: "Confirm my email" },
      footer:
        "This link is good for 24 hours. If you didn't sign up for Rock Works, you can ignore this email.",
    }),
  });
}

function passwordResetEmail({ to, link }) {
  return sendMail({
    to,
    subject: "Reset your password — Rock Works School of Music",
    text: [
      "We got a request to reset the password on your Rock Works account.",
      "",
      "Set a new password here:",
      link,
      "",
      "The link is good for 1 hour and can only be used once.",
      "If you didn't ask for this, ignore this email — your password won't change.",
    ].join("\n"),
    html: layout({
      heading: "Reset your password",
      lines: [
        "We got a request to reset the password on your Rock Works account.",
        "Choose a new one and you'll be back to your lessons in a moment.",
      ],
      button: { href: link, label: "Set a new password" },
      footer:
        "This link is good for 1 hour and can only be used once. If you didn't ask for a reset, you can ignore this email — your password won't change.",
    }),
  });
}

// Sent after the fact, so someone who didn't make the change hears about it.
// This is the one message whose reader may need to reach a human urgently, so
// it names the contact address — but only when one is actually configured.
function passwordChangedEmail({ to }) {
  return sendMail({
    to,
    subject: "Your password was changed — Rock Works School of Music",
    text: [
      "The password on your Rock Works account was just changed.",
      "",
      "If that was you, there's nothing to do.",
      REPLY_TO
        ? `If it wasn't, reset your password immediately and contact us at ${REPLY_TO}.`
        : "If it wasn't, reset your password immediately.",
    ].join("\n"),
    html: layout({
      heading: "Your password was changed",
      lines: [
        "The password on your Rock Works account was just changed.",
        "If that was you, there's nothing to do here.",
      ],
      footer: REPLY_TO
        ? `If this wasn't you, reset your password straight away and let us know at <a href="mailto:${REPLY_TO}" style="color:#0e8a97;">${REPLY_TO}</a>.`
        : "If this wasn't you, reset your password straight away.",
    }),
  });
}

module.exports = {
  sendMail,
  verificationEmail,
  passwordResetEmail,
  passwordChangedEmail,
  smtpConfigured,
};
