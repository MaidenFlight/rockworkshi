const nodemailer = require("nodemailer");
const { INSTRUMENTS } = require("./lessonVideos");

// SMTP mailer (Resend in production, see .env.example).
// In dev with no SMTP config, mail goes to an Ethereal test inbox and the
// preview URL is logged. Production throws instead of falling back.
const FROM =
  process.env.MAIL_FROM ||
  "Rock Works School of Music <denny.landika@rockworksschoolofmusichawaii.com>";
// Set to "" to send without a Reply-To header.
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
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Short timeouts: Render blocks port 587 and the default timeouts are minutes long.
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
  // Cache the transport, but not a failed one.
  if (!transportPromise) {
    transportPromise = buildTransport().catch((err) => {
      transportPromise = null;
      throw err;
    });
  }
  return transportPromise;
}

// Replies go to the school's inbox unless a notice to the school points them at the sender instead.
async function sendMail({ to, subject, text, html, replyTo = REPLY_TO }) {
  const { transport, kind } = await getTransport();
  const info = await transport.sendMail({
    from: FROM,
    ...(replyTo ? { replyTo } : {}),
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

// Anything a person typed (a student's name, say) must go through this before it reaches HTML.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Something a person typed, as one short line: control characters and line breaks become spaces.
function oneLine(value, max) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

// heading, lines and the button are plain text and are escaped here. footer is trusted HTML
// written in this file (it may hold a mailto link), so never put anything a user typed in it.
function layout({ heading, lines, button, footer }) {
  // Tables + inline styles for email client support.
  const body = lines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#33454f;">${escapeHtml(line)}</p>`
    )
    .join("");
  const href = button ? escapeHtml(button.href) : "";

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
                <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:#0a2338;">${escapeHtml(heading)}</h1>
                ${body}
                ${
                  button
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                         <tr><td style="border-radius:999px;background:#ef5130;">
                           <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(button.label)}</a>
                         </td></tr>
                       </table>
                       <p style="margin:16px 0 0;font-size:12.5px;line-height:1.55;color:#8a7d6a;">If the button doesn't work, paste this into your browser:<br><a href="${href}" style="color:#0e8a97;word-break:break-all;">${href}</a></p>`
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

// An admin invites a parent or guardian to follow a student's classes and work. The student chose
// their own name, so it's kept to one short line here and escaped by layout() in the HTML.
function renderGuardianInvite({ studentName, link }) {
  const name = oneLine(studentName, 80) || "your student";
  return {
    subject: "You're invited to follow " + name + " at Rock Works",
    text: [
      "Rock Works School of Music has invited you to follow " + name + "'s classes, practice work and feedback.",
      "",
      "Accept the invitation here:",
      link,
      "",
      "The link is good for 7 days. If you weren't expecting this, ignore this email.",
    ].join("\n"),
    html: layout({
      heading: "Follow " + name + " at Rock Works",
      lines: [
        "Rock Works School of Music has invited you to follow " + name + "'s classes, practice work and teacher feedback.",
        "You'll also be the one who gives or withdraws consent for what the school keeps about them.",
      ],
      button: { href: link, label: "Accept the invitation" },
      footer: "This link is good for 7 days. If you weren't expecting this, you can ignore this email.",
    }),
  };
}

function guardianInviteEmail({ to, studentName, link }) {
  return sendMail({ to, ...renderGuardianInvite({ studentName, link }) });
}

// The reply to a trial request. Whoever typed the address gets back only the names and a known
// instrument, never the free text, so the public form can't send a stranger someone else's words.
function renderTrialConfirmation({ studentName, guardian, instrument }) {
  const student = oneLine(studentName, 80);
  const parent = oneLine(guardian, 80);
  const lesson = INSTRUMENTS.includes(instrument)
    ? `a free ${instrument === "Drums" ? "drum" : instrument.toLowerCase()} lesson`
    : "a free trial lesson";
  const lines = [
    `Hi ${parent || student || "there"},`,
    `Thanks for asking about ${lesson}${parent && student ? ` for ${student}` : ""}.`,
    "Our website is still in its testing stage. Our goal is to have it fully live by the start of 2027, and we'll be in touch within the next month or two to find a time that works.",
    ...(REPLY_TO ? ["If you have a question before then, just reply to this email."] : []),
  ];
  const why =
    "You're getting this because this address was used to ask for a trial lesson on the Rock Works website. If that wasn't you, you can ignore this email.";
  return {
    subject: "Your trial lesson request — Rock Works School of Music",
    text: [...lines, why].join("\n\n"),
    html: layout({ heading: "We got your trial request", lines, footer: why }),
  };
}

// The same request for the school's inbox, with everything the form sent. Reply-To is the sender,
// so answering them is just Reply.
function renderTrialNotice(trial) {
  const fields = [
    ["Student", trial.studentName],
    ["Age", trial.age],
    ["Parent or guardian", trial.guardian],
    ["Email", trial.email],
    ["Phone", trial.phone],
    ["Instrument", trial.instrument],
    ["Played before", trial.experience],
    ["Format", trial.format],
    ["Availability", trial.availability],
    ["Favorite music", trial.favorites],
    ["A song they want to play", trial.goals],
    ["Notes", trial.notes],
  ];
  const lines = fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  const next = "Reply to this email to answer them. They've been told to expect to hear from the school within the next month or two.";
  return {
    subject: `New trial request: ${oneLine(trial.studentName, 80)}`,
    text: [...lines, "", next].join("\n"),
    html: layout({ heading: "New trial request", lines: [...lines, next] }),
  };
}

// Both emails for a new trial request. One failing doesn't stop the other, and the request is
// saved and listed in Admin either way.
async function trialRequestEmails(trial) {
  const sends = [sendMail({ to: trial.email, ...renderTrialConfirmation(trial) })];
  if (REPLY_TO) sends.push(sendMail({ to: REPLY_TO, replyTo: trial.email, ...renderTrialNotice(trial) }));
  const failed = (await Promise.allSettled(sends)).find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

module.exports = {
  escapeHtml,
  renderGuardianInvite,
  guardianInviteEmail,
  renderTrialConfirmation,
  renderTrialNotice,
  trialRequestEmails,
  sendMail,
  verificationEmail,
  passwordResetEmail,
  passwordChangedEmail,
  smtpConfigured,
};
