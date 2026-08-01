// Generic SMTP-based mailer. This deliberately doesn't hard-code any one
// provider's SDK — nodemailer + SMTP works with Gmail (app password),
// Resend, SendGrid, Mailgun, Postmark, or your own mail server, all of
// which offer plain SMTP credentials. Switching providers later is just an
// env var change, not a code change.
//
// Required in .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// e.g. for Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=you@gmail.com,
// SMTP_PASS=<16-character app password, not your real password>, MAIL_FROM="ClutchCircuit <you@gmail.com>"

import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("Email sending isn't configured on this server yet.");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // true for 465, false (STARTTLS) for 587/others
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @param {string} [text] - plain-text fallback; HTML-only emails read as
 *   more "templated" to spam filters, so always pass one where practical
 */
export async function sendMail(to, subject, html, text) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({ from, to, subject, html, text });
}