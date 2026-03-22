import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

const FROM = "V8 Sim House <bookings@book.v8simhouse.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "support@v8simhouse.com";

interface BookingEmailData {
  clientName: string;
  clientEmail: string;
  bookingId: string;
  eventDate: string;
  eventTime: string;
  packageLabel: string;
  subtotal: number;
  depositAmount: number;
  remainderAmount: number;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function baseTemplate(title: string, body: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Raleway', Arial, sans-serif; background: #000; color: #ddd; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { color: #ddd; font-size: 24px; font-weight: 700; margin-bottom: 32px; }
    .logo span { color: #d32027; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 32px; margin: 24px 0; }
    h1 { color: #ddd; font-size: 22px; margin: 0 0 16px; }
    p { color: #aaa; line-height: 1.7; margin: 0 0 12px; }
    .label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .value { color: #ddd; font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 20px 0; }
    .highlight { color: #d32027; font-weight: 700; }
    .btn { display: inline-block; background: #d32027; color: #fff; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-top: 16px; }
    .footer { margin-top: 40px; color: #444; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">V8 <span>Sim House</span></div>
    <h1>${title}</h1>
    ${body}
    <div class="footer">
      <p>V8 Sim House LLC &middot; Connecticut, USA &middot; support@v8simhouse.com</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBookingSubmittedClient(data: BookingEmailData) {
  return getResend().emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: "We received your booking request — V8 Sim House",
    html: baseTemplate(
      "We got your request!",
      `<div class="card">
        <p>Hi ${data.clientName},</p>
        <p>Thanks for reaching out! We have received your booking request and will review it shortly. You will hear from us within 24-48 hours.</p>
        <hr class="divider">
        <div class="label">Booking Reference</div>
        <div class="value">#${data.bookingId.slice(0, 8).toUpperCase()}</div>
        <div class="label">Event Date</div>
        <div class="value">${data.eventDate} at ${data.eventTime}</div>
        <div class="label">Package</div>
        <div class="value">${data.packageLabel}</div>
        <div class="label">Deposit (held on card)</div>
        <div class="value">${formatCurrency(data.depositAmount)}</div>
        <hr class="divider">
        <p><strong>What happens next?</strong></p>
        <p>Your card has been <strong>authorized for the deposit amount</strong> but not charged yet. Once we confirm your booking, we will capture the deposit and send you a confirmation email.</p>
      </div>`
    ),
  });
}

export async function sendBookingSubmittedAdmin(data: BookingEmailData) {
  return getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New booking request from ${data.clientName}`,
    html: baseTemplate(
      `New Booking Request`,
      `<div class="card">
        <div class="label">Client</div>
        <div class="value">${data.clientName}</div>
        <div class="label">Booking ID</div>
        <div class="value">#${data.bookingId.slice(0, 8).toUpperCase()}</div>
        <div class="label">Event Date</div>
        <div class="value">${data.eventDate} at ${data.eventTime}</div>
        <div class="label">Package</div>
        <div class="value">${data.packageLabel}</div>
        <div class="label">Total / Deposit</div>
        <div class="value">${formatCurrency(data.subtotal)} / ${formatCurrency(data.depositAmount)}</div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/bookings/${data.bookingId}" class="btn">Review Booking</a>
      </div>`
    ),
  });
}

export async function sendBookingApproved(data: BookingEmailData) {
  return getResend().emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: "Your V8 Sim booking is confirmed!",
    html: baseTemplate(
      "You are confirmed!",
      `<div class="card">
        <p>Hi ${data.clientName},</p>
        <p>Great news - your booking has been <span class="highlight">approved!</span> We are excited to bring the V8 Sim experience to your event.</p>
        <hr class="divider">
        <div class="label">Event Date</div>
        <div class="value">${data.eventDate} at ${data.eventTime}</div>
        <div class="label">Package</div>
        <div class="value">${data.packageLabel}</div>
        <div class="label">Deposit Charged</div>
        <div class="value">${formatCurrency(data.depositAmount)}</div>
        <div class="label">Remainder Due on Event Day</div>
        <div class="value">${formatCurrency(data.remainderAmount)}</div>
        <hr class="divider">
        <p>The remaining balance will be automatically collected on the day of your event. If you have any questions, reply to this email.</p>
      </div>`
    ),
  });
}

export async function sendBookingDeclined(data: Pick<BookingEmailData, "clientName" | "clientEmail" | "bookingId">) {
  return getResend().emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: "Update on your V8 Sim booking request",
    html: baseTemplate(
      "An update on your request",
      `<div class="card">
        <p>Hi ${data.clientName},</p>
        <p>Unfortunately, we are unable to confirm your booking request at this time. Your card authorization has been <strong>fully released</strong> - no charges were made.</p>
        <p>If you would like to try a different date or have questions, please reach out at <a href="mailto:support@v8simhouse.com" style="color:#d32027;">support@v8simhouse.com</a>.</p>
      </div>`
    ),
  });
}

export async function sendBookingCancelled(data: Pick<BookingEmailData, "clientName" | "clientEmail" | "eventDate" | "depositAmount">) {
  return getResend().emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: "Your V8 Sim booking has been cancelled",
    html: baseTemplate(
      "Booking Cancellation",
      `<div class="card">
        <p>Hi ${data.clientName},</p>
        <p>Your booking for <strong>${data.eventDate}</strong> has been cancelled.</p>
        <p>Please note that as per our policy, the deposit of <strong>${formatCurrency(data.depositAmount)}</strong> is non-refundable. No further charges will be made.</p>
        <p>We hope to see you at a future event. Reach out anytime at <a href="mailto:support@v8simhouse.com" style="color:#d32027;">support@v8simhouse.com</a>.</p>
      </div>`
    ),
  });
}

export async function sendEventReminder(data: Pick<BookingEmailData, "clientName" | "clientEmail" | "eventDate" | "eventTime" | "remainderAmount">) {
  return getResend().emails.send({
    from: FROM,
    to: data.clientEmail,
    subject: "See you tomorrow! - V8 Sim reminder",
    html: baseTemplate(
      "See you tomorrow!",
      `<div class="card">
        <p>Hi ${data.clientName},</p>
        <p>Just a friendly reminder that your V8 Sim experience is <strong>tomorrow, ${data.eventDate} at ${data.eventTime}</strong>.</p>
        <p>A reminder that the remaining balance of <strong>${formatCurrency(data.remainderAmount)}</strong> will be collected on the day of the event.</p>
        <p>If you have any last-minute questions, reply to this email. We cannot wait to see you!</p>
      </div>`
    ),
  });
}
