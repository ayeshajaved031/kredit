// ==============================================================
// Mailer
// --------------------------------------------------------------
// Centralized nodemailer wrapper. All transactional email goes
// through sendMail() so the templates and from-address stay
// consistent.
//
// In development we use Mailtrap (free SMTP sandbox — no real
// emails sent). In production, swap SMTP_* env vars for a real
// provider (SendGrid, Mailgun, AWS SES, etc.) — no code change
// required.
//
// If SMTP isn't configured, we log emails to the console instead
// of throwing. This keeps registration usable in local dev when
// the team hasn't set up Mailtrap yet.
// ==============================================================

const nodemailer = require("nodemailer");

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // dev-mode fallback handled in sendMail()
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 2525,
    secure: Number(SMTP_PORT) === 465, // true only for 465; false for 587/2525
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return cachedTransporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || "Kredit <noreply@kredit.pk>";

  // Dev fallback — log instead of send. Useful when running locally
  // without SMTP creds.
  if (!transporter) {
    console.log("\n[MAIL — DEV LOG]");
    console.log(`From:    ${from}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:    ${text || html?.replace(/<[^>]+>/g, "")}\n`);
    return { dev: true };
  }

  const info = await transporter.sendMail({ from, to, subject, html, text });
  return info;
};

// ----------------- Templates -----------------
// Kept as plain functions so the team can read and tweak them
// without learning a templating library.

const verificationEmail = ({ name, verifyUrl }) => ({
  subject: "Verify your Kredit account",
  text: `Welcome to Kredit, ${name}!\n\nVerify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e;margin:0 0 12px">Welcome to Kredit, ${escapeHtml(name)}</h2>
      <p>Thanks for signing up. Please confirm your email address to activate your account.</p>
      <p style="margin:24px 0">
        <a href="${verifyUrl}" style="background:#0f766e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
          Verify Email
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px">If the button doesn't work, paste this into your browser:<br>${verifyUrl}</p>
      <p style="color:#6b7280;font-size:14px">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
    </div>`,
});

const passwordResetEmail = ({ name, resetUrl }) => ({
  subject: "Reset your Kredit password",
  text: `Hi ${name},\n\nReset your password at: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore the email.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e;margin:0 0 12px">Password reset request</h2>
      <p>Hi ${escapeHtml(name)}, we received a request to reset your password.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#0f766e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you didn't request a reset, ignore this email — your password is unchanged.</p>
    </div>`,
});

const kycReceivedEmail = ({ name }) => ({
  subject: "We've received your KYC documents",
  text: `Hi ${name},\n\nWe've received your KYC documents and our team is reviewing them. You'll hear back within 2 business days.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">KYC documents received</h2>
      <p>Hi ${escapeHtml(name)}, thanks for submitting your KYC documents.</p>
      <p>Our team is reviewing them and we'll get back to you within 2 business days. Once approved, you can start submitting financing requests.</p>
    </div>`,
});

const kycApprovedEmail = ({ name, creditLimitPKR }) => ({
  subject: "Your KYC has been approved — credit limit assigned",
  text: `Hi ${name},\n\nGreat news — your KYC has been approved.\n\nYour assigned credit limit: PKR ${Number(creditLimitPKR).toLocaleString("en-PK")}.\n\nYou can now submit financing requests for SaaS subscriptions through your Kredit dashboard.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">KYC approved</h2>
      <p>Hi ${escapeHtml(name)}, great news — your KYC has been approved.</p>
      <p style="background:#ecfdf5;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <strong>Approved credit limit:</strong> PKR ${Number(creditLimitPKR).toLocaleString("en-PK")}
      </p>
      <p>You can now submit financing requests for SaaS subscriptions through your Kredit dashboard.</p>
    </div>`,
});

const kycRejectedEmail = ({ name, reason }) => ({
  subject: "KYC review — additional information needed",
  text: `Hi ${name},\n\nWe've reviewed your KYC documents and weren't able to approve them at this stage.\n\nReason: ${reason}\n\nYou can re-submit corrected documents from your Kredit dashboard.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">KYC needs attention</h2>
      <p>Hi ${escapeHtml(name)}, we've reviewed your KYC documents and weren't able to approve them at this stage.</p>
      <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <strong>Reason:</strong> ${escapeHtml(reason)}
      </p>
      <p>You can re-submit corrected documents from your Kredit dashboard. If you need help, reply to this email or open a support ticket.</p>
    </div>`,
});

const requestApprovedEmail = ({ name, requestId, vendorName, totalPayable, monthlyInstallment }) => ({
  subject: `Your financing request ${requestId} has been approved`,
  text: `Hi ${name},\n\nYour financing request for ${vendorName} has been approved. Your Murabaha contract is ready for review and signing.\n\nTotal payable: PKR ${Number(totalPayable).toLocaleString("en-PK")}\nMonthly installment: PKR ${Number(monthlyInstallment).toLocaleString("en-PK")} for 12 months\n\nLog in to your Kredit dashboard to review and sign the contract.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Financing request approved</h2>
      <p>Hi ${escapeHtml(name)}, your financing request for <strong>${escapeHtml(vendorName)}</strong> has been approved.</p>
      <div style="background:#ecfdf5;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Request:</strong> ${escapeHtml(requestId)}</p>
        <p style="margin:0 0 6px"><strong>Total payable:</strong> PKR ${Number(totalPayable).toLocaleString("en-PK")}</p>
        <p style="margin:0"><strong>Monthly installment:</strong> PKR ${Number(monthlyInstallment).toLocaleString("en-PK")} for 12 months</p>
      </div>
      <p>Your Murabaha contract is ready for review. Log in to your Kredit dashboard to read the terms and sign.</p>
    </div>`,
});

const requestRejectedEmail = ({ name, requestId, vendorName, reason }) => ({
  subject: `Your financing request ${requestId} was not approved`,
  text: `Hi ${name},\n\nUnfortunately we couldn't approve your financing request for ${vendorName}.\n\nReason: ${reason}\n\nYou can submit a new request anytime, or reach out to our support team if you have questions.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">Financing request not approved</h2>
      <p>Hi ${escapeHtml(name)}, unfortunately we couldn't approve your financing request <strong>${escapeHtml(requestId)}</strong> for ${escapeHtml(vendorName)}.</p>
      <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <strong>Reason:</strong> ${escapeHtml(reason)}
      </p>
      <p>You can submit a new request anytime, or reach out to our support team if you'd like to discuss.</p>
    </div>`,
});

const accountBlockedEmail = ({ name, reason }) => ({
  subject: "Your Kredit account has been suspended",
  text: `Hi ${name},\n\nYour Kredit account has been suspended.\n\nReason: ${reason}\n\nIf you believe this is in error, please contact support@kredit.pk.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">Account suspended</h2>
      <p>Hi ${escapeHtml(name)}, your Kredit account has been suspended.</p>
      <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <strong>Reason:</strong> ${escapeHtml(reason)}
      </p>
      <p>If you believe this is in error, please reply to this email or contact support@kredit.pk.</p>
    </div>`,
});

const contractActivatedEmail = ({
  name, contractId, vendorName, totalPayable, monthlyInstallment, firstDueDate,
}) => ({
  subject: `Contract ${contractId} is active — ${vendorName} subscription paid`,
  text: `Hi ${name},\n\nYour Murabaha contract ${contractId} is now active. We've paid ${vendorName} on your behalf.\n\nTotal payable: PKR ${Number(totalPayable).toLocaleString("en-PK")}\nMonthly installment: PKR ${Number(monthlyInstallment).toLocaleString("en-PK")}\nFirst due date: ${firstDueDate}\n\nReminders will be sent 3 days before each due date.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Contract activated 🎉</h2>
      <p>Hi ${escapeHtml(name)}, your Murabaha contract <strong>${escapeHtml(contractId)}</strong> is now active.</p>
      <p>We've paid <strong>${escapeHtml(vendorName)}</strong> on your behalf — your subscription is good for the full year.</p>
      <div style="background:#ecfdf5;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Total payable:</strong> PKR ${Number(totalPayable).toLocaleString("en-PK")}</p>
        <p style="margin:0 0 6px"><strong>Monthly installment:</strong> PKR ${Number(monthlyInstallment).toLocaleString("en-PK")}</p>
        <p style="margin:0"><strong>First due date:</strong> ${escapeHtml(firstDueDate)}</p>
      </div>
      <p style="color:#6b7280;font-size:14px">We'll send a reminder 3 days before each installment is due. View your full schedule in the dashboard.</p>
    </div>`,
});

const vendorPaymentFailedEmail = ({ name, contractId, vendorName, reason }) => ({
  subject: `Action needed: vendor payment failed for ${contractId}`,
  text: `Hi ${name},\n\nWe encountered an issue paying ${vendorName} for your contract ${contractId}.\n\nReason: ${reason}\n\nThe contract has been rolled back. Please contact support@kredit.pk and we'll re-process the payment.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">Vendor payment failed</h2>
      <p>Hi ${escapeHtml(name)}, we couldn't pay <strong>${escapeHtml(vendorName)}</strong> for your contract <strong>${escapeHtml(contractId)}</strong>.</p>
      <p style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <strong>Reason:</strong> ${escapeHtml(reason)}
      </p>
      <p>The contract has been rolled back to draft status — you have not been charged. Please contact support@kredit.pk and we'll re-process the payment as soon as the issue is resolved.</p>
    </div>`,
});

const installmentReminderEmail = ({ name, contractId, installmentNumber, amountDue, dueDate, daysRemaining }) => ({
  subject: `Reminder: installment ${installmentNumber} due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
  text: `Hi ${name},\n\nA gentle reminder that installment ${installmentNumber} of your contract ${contractId} is due on ${dueDate}.\n\nAmount due: PKR ${Number(amountDue).toLocaleString("en-PK")}\n\nWe'll auto-charge your linked account on the due date. To avoid late charges, please ensure sufficient balance is available.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Upcoming installment</h2>
      <p>Hi ${escapeHtml(name)}, a gentle reminder about installment <strong>${installmentNumber}</strong> on contract <strong>${escapeHtml(contractId)}</strong>.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Amount due:</strong> PKR ${Number(amountDue).toLocaleString("en-PK")}</p>
        <p style="margin:0"><strong>Due date:</strong> ${escapeHtml(dueDate)} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} from now)</p>
      </div>
      <p style="color:#6b7280;font-size:14px">We'll auto-charge your linked account on the due date. Please make sure your account has sufficient balance to avoid late charges.</p>
    </div>`,
});

const installmentReceiptEmail = ({
  name, contractId, paymentId, installmentNumber, totalInstallments,
  amount, paidAt, remainingInstallments, remainingBalance,
}) => ({
  subject: `Payment receipt — ${paymentId}`,
  text: `Hi ${name},\n\nThank you. Your installment ${installmentNumber}/${totalInstallments} for contract ${contractId} has been processed successfully.\n\nAmount: PKR ${Number(amount).toLocaleString("en-PK")}\nPayment ID: ${paymentId}\nProcessed at: ${paidAt}\n\nRemaining: ${remainingInstallments} installment${remainingInstallments === 1 ? "" : "s"} totalling PKR ${Number(remainingBalance).toLocaleString("en-PK")}.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Payment received ✓</h2>
      <p>Hi ${escapeHtml(name)}, thank you. Your installment has been processed successfully.</p>
      <div style="background:#ecfdf5;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Contract:</strong> ${escapeHtml(contractId)}</p>
        <p style="margin:0 0 6px"><strong>Installment:</strong> ${installmentNumber} of ${totalInstallments}</p>
        <p style="margin:0 0 6px"><strong>Amount:</strong> PKR ${Number(amount).toLocaleString("en-PK")}</p>
        <p style="margin:0 0 6px"><strong>Payment ID:</strong> ${escapeHtml(paymentId)}</p>
        <p style="margin:0"><strong>Processed at:</strong> ${escapeHtml(paidAt)}</p>
      </div>
      <p style="color:#6b7280;font-size:14px">Remaining: <strong>${remainingInstallments}</strong> installment${remainingInstallments === 1 ? "" : "s"}, totalling <strong>PKR ${Number(remainingBalance).toLocaleString("en-PK")}</strong>.</p>
    </div>`,
});

const installmentFailedEmail = ({
  name, contractId, installmentNumber, amount, reason, lateFee, nextRetryDate,
}) => ({
  subject: `Payment failed — installment ${installmentNumber} of ${contractId}`,
  text: `Hi ${name},\n\nWe were unable to process installment ${installmentNumber} for contract ${contractId}.\n\nAmount: PKR ${Number(amount).toLocaleString("en-PK")}\nReason: ${reason}\nLate fee added: PKR ${Number(lateFee).toLocaleString("en-PK")}\n\nWe'll retry on ${nextRetryDate}. To avoid further late charges, please ensure your linked account has sufficient balance, or pay manually from your dashboard.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">Payment failed</h2>
      <p>Hi ${escapeHtml(name)}, we couldn't process installment <strong>${installmentNumber}</strong> for contract <strong>${escapeHtml(contractId)}</strong>.</p>
      <div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Amount:</strong> PKR ${Number(amount).toLocaleString("en-PK")}</p>
        <p style="margin:0 0 6px"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
        <p style="margin:0"><strong>Late fee:</strong> PKR ${Number(lateFee).toLocaleString("en-PK")} (donated to charity per Shariah compliance)</p>
      </div>
      <p>We'll retry on <strong>${escapeHtml(nextRetryDate)}</strong>. Avoid further charges by ensuring your linked account has sufficient balance, or pay manually from your dashboard now.</p>
    </div>`,
});

const contractCompletedEmail = ({ name, contractId, vendorName, totalPaid }) => ({
  subject: `🎉 Contract ${contractId} fully repaid — thank you!`,
  text: `Hi ${name},\n\nCongratulations — you've made the final payment on contract ${contractId} for ${vendorName}.\n\nTotal paid: PKR ${Number(totalPaid).toLocaleString("en-PK")}\n\nYour credit limit has been freed up for future financing. Thank you for choosing Kredit.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Contract fully repaid 🎉</h2>
      <p>Hi ${escapeHtml(name)}, congratulations — you've made the final payment on contract <strong>${escapeHtml(contractId)}</strong> for <strong>${escapeHtml(vendorName)}</strong>.</p>
      <div style="background:#ecfdf5;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0"><strong>Total paid:</strong> PKR ${Number(totalPaid).toLocaleString("en-PK")}</p>
      </div>
      <p>Your credit limit has been freed up for future financing through Kredit. Thank you for being part of the platform.</p>
    </div>`,
});

const contractDefaultedEmail = ({ name, contractId, missedCount, outstandingAmount }) => ({
  subject: `Important: contract ${contractId} marked as defaulted`,
  text: `Hi ${name},\n\nDue to ${missedCount} consecutive missed payments, contract ${contractId} has been marked as defaulted.\n\nOutstanding balance: PKR ${Number(outstandingAmount).toLocaleString("en-PK")}\n\nPlease contact support@kredit.pk immediately to resolve this. Your ability to take new financing through Kredit will be restricted until this is resolved.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#b91c1c">Contract defaulted</h2>
      <p>Hi ${escapeHtml(name)}, due to <strong>${missedCount} consecutive missed payments</strong>, contract <strong>${escapeHtml(contractId)}</strong> has been marked as defaulted.</p>
      <div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:16px 0">
        <p style="margin:0"><strong>Outstanding balance:</strong> PKR ${Number(outstandingAmount).toLocaleString("en-PK")}</p>
      </div>
      <p>Please contact <a href="mailto:support@kredit.pk">support@kredit.pk</a> immediately to resolve this. Your ability to take new financing through Kredit will be restricted until this matter is resolved.</p>
    </div>`,
});

const ticketCreatedEmail = ({ name, ticketNumber, subject, category }) => ({
  subject: `Support ticket ${ticketNumber} received — we're on it`,
  text: `Hi ${name},\n\nWe've received your support ticket and assigned it tracking number ${ticketNumber}.\n\nSubject: ${subject}\nCategory: ${category}\n\nA member of our team will reply soon. You can also follow the conversation from your Kredit dashboard.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Support ticket received</h2>
      <p>Hi ${escapeHtml(name)}, we've received your ticket and assigned it tracking number <strong>${escapeHtml(ticketNumber)}</strong>.</p>
      <div style="background:#f0fdfa;border-left:4px solid #0f766e;padding:12px 16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p style="margin:0"><strong>Category:</strong> ${escapeHtml(category)}</p>
      </div>
      <p>A member of our team will reply soon. You can also follow the conversation from your Kredit dashboard.</p>
    </div>`,
});

const ticketReplyEmail = ({ name, ticketNumber, replyAuthorRole, snippet }) => ({
  subject: `New reply on ticket ${ticketNumber}`,
  text: `Hi ${name},\n\nThere's a new reply from ${replyAuthorRole === "admin" ? "Kredit Support" : "the requester"} on ticket ${ticketNumber}:\n\n"${snippet}"\n\nView the full conversation in your Kredit dashboard.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">New reply on ticket ${escapeHtml(ticketNumber)}</h2>
      <p>Hi ${escapeHtml(name)}, there's a new reply from <strong>${replyAuthorRole === "admin" ? "Kredit Support" : "the requester"}</strong>:</p>
      <blockquote style="background:#f9fafb;border-left:4px solid #6b7280;padding:12px 16px;margin:16px 0;color:#374151">
        ${escapeHtml(snippet)}
      </blockquote>
      <p>View the full conversation in your Kredit dashboard.</p>
    </div>`,
});

const ticketResolvedEmail = ({ name, ticketNumber, subject }) => ({
  subject: `Ticket ${ticketNumber} resolved`,
  text: `Hi ${name},\n\nTicket ${ticketNumber} (${subject}) has been marked as resolved.\n\nIf the issue isn't fully resolved, just reply on the ticket and we'll re-open it.`,
  html: `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#0f766e">Ticket resolved ✓</h2>
      <p>Hi ${escapeHtml(name)}, ticket <strong>${escapeHtml(ticketNumber)}</strong> (${escapeHtml(subject)}) has been marked as resolved.</p>
      <p style="color:#6b7280;font-size:14px">If the issue isn't fully resolved, just reply on the ticket and we'll re-open it.</p>
    </div>`,
});

// Tiny utility to prevent template-injection through user-supplied names
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

module.exports = {
  sendMail,
  templates: {
    verificationEmail,
    passwordResetEmail,
    kycReceivedEmail,
    kycApprovedEmail,
    kycRejectedEmail,
    requestApprovedEmail,
    requestRejectedEmail,
    accountBlockedEmail,
    contractActivatedEmail,
    vendorPaymentFailedEmail,
    installmentReminderEmail,
    installmentReceiptEmail,
    installmentFailedEmail,
    contractCompletedEmail,
    contractDefaultedEmail,
    ticketCreatedEmail,
    ticketReplyEmail,
    ticketResolvedEmail,
  },
};
