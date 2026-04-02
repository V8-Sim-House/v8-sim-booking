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
  eventType?: string | null;
  expectedGuests?: number | null;
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
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }
    body { font-family: Arial, sans-serif; background: #000000; color: #dddddd; margin: 0; padding: 0; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 32px; margin: 24px 0; }
    .label { color: #666666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .value { color: #dddddd; font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 20px 0; }
    .highlight { color: #d32027; font-weight: 700; }
    .btn { display: inline-block; background: #d32027; color: #ffffff !important; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-top: 16px; }
  </style>
</head>
<body bgcolor="#000000" style="margin:0;padding:0;background-color:#000000;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:24px;font-weight:700;color:#dddddd;padding-bottom:32px;">
              V8 <span style="color:#d32027;">Sim House</span>
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#dddddd;padding-bottom:8px;">
              ${title}
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;color:#aaaaaa;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="font-family:Arial,sans-serif;font-size:12px;color:#444444;padding-top:40px;">
              V8 Sim House LLC &middot; Connecticut, USA &middot; support@v8simhouse.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
        ${data.eventType ? `<div class="label">Event Type</div><div class="value">${data.eventType}</div>` : ""}
        ${data.expectedGuests ? `<div class="label">Expected Guests</div><div class="value">${data.expectedGuests}</div>` : ""}
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
        ${data.eventType ? `<div class="label">Event Type</div><div class="value">${data.eventType}</div>` : ""}
        ${data.expectedGuests ? `<div class="label">Expected Guests</div><div class="value">${data.expectedGuests}</div>` : ""}
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
        ${data.eventType ? `<div class="label">Event Type</div><div class="value">${data.eventType}</div>` : ""}
        ${data.expectedGuests ? `<div class="label">Expected Guests</div><div class="value">${data.expectedGuests}</div>` : ""}
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

// ─── Lead capture emails ──────────────────────────────────────────────────────

const PACKAGE_TABLE = `
<table style="width:100%;border-collapse:collapse;margin:12px 0;">
  <thead>
    <tr style="border-bottom:1px solid #2a2a2a;">
      <th style="text-align:left;padding:8px 4px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Package</th>
      <th style="text-align:left;padding:8px 4px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Duration</th>
      <th style="text-align:right;padding:8px 4px;color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Price</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom:1px solid #222;">
      <td style="padding:10px 4px;color:#ddd;">1 Hour</td>
      <td style="padding:10px 4px;color:#aaa;">1 hr</td>
      <td style="padding:10px 4px;color:#ddd;text-align:right;font-weight:600;">$300</td>
    </tr>
    <tr style="border-bottom:1px solid #222;">
      <td style="padding:10px 4px;color:#ddd;">2 Hour <span style="background:#d32027;color:#fff;font-size:10px;padding:1px 6px;border-radius:99px;font-weight:700;vertical-align:middle;">Popular</span></td>
      <td style="padding:10px 4px;color:#aaa;">2 hrs</td>
      <td style="padding:10px 4px;color:#ddd;text-align:right;font-weight:600;">$460</td>
    </tr>
    <tr style="border-bottom:1px solid #222;">
      <td style="padding:10px 4px;color:#ddd;">3 Hour</td>
      <td style="padding:10px 4px;color:#aaa;">3 hrs</td>
      <td style="padding:10px 4px;color:#ddd;text-align:right;font-weight:600;">$610</td>
    </tr>
    <tr>
      <td style="padding:10px 4px;color:#ddd;">Custom</td>
      <td style="padding:10px 4px;color:#aaa;">You choose</td>
      <td style="padding:10px 4px;color:#ddd;text-align:right;font-weight:600;">$200/hr + $100 setup</td>
    </tr>
  </tbody>
</table>`;

function buildAddonsList(addons?: Array<{ label: string; price: number; is_per_hour: boolean }>) {
  const items = addons && addons.length > 0
    ? addons.map((a) =>
        `<li>${a.label} — ${a.is_per_hour ? `$${a.price}/hr` : `$${a.price}`}</li>`
      ).join("")
    : `<li>Extra VR Headset — $50</li><li>Generator Rental (no power outlet needed) — $100</li>`;
  return `<ul style="margin:8px 0 0;padding-left:20px;color:#aaa;line-height:2;">${items}</ul>`;
}

const WHATS_INCLUDED = `
<ul style="margin:8px 0 0;padding-left:0;list-style:none;color:#aaa;line-height:2;">
  <li>&#10003; Professional simulator delivered &amp; set up at your location</li>
  <li>&#10003; Trained operator present throughout the entire event</li>
  <li>&#10003; Live leaderboard &amp; competitive race format</li>
  <li>&#10003; Full teardown and removal after your event</li>
</ul>
<p style="color:#aaa;margin:8px 0 0;font-size:13px;">Space Required: 22ft &times; 12ft clear area, 10ft ceiling height</p>`;

function formatEventDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const PACKAGE_DISPLAY: Record<string, { label: string; price: string; deposit: string }> = {
  standard_1h: { label: "1 Hour Package", price: "$300", deposit: "$90" },
  standard_2h: { label: "2 Hour Package", price: "$460", deposit: "$138" },
  standard_3h: { label: "3 Hour Package", price: "$610", deposit: "$183" },
  custom: { label: "Custom Package", price: "$200/hr + $100 setup", deposit: "30% of total" },
};

export async function sendLeadPricingSummary(data: {
  firstName: string;
  email: string;
  eventType: string;
  eventDate: string;
  leadId: string;
  addons?: Array<{ label: string; price: number; is_per_hour: boolean }>;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.v8simhouse.com";
  const displayDate = formatEventDate(data.eventDate);
  const resumeUrl = `${appUrl}/book?lead=${data.leadId}`;

  return getResend().emails.send({
    from: FROM,
    to: data.email,
    subject: `Your V8 Sim Pricing & Availability — ${displayDate}`,
    html: baseTemplate(
      "Your V8 Sim Pricing &amp; Availability",
      `<div class="card">
        <p>Hi ${data.firstName},</p>
        <p>Thanks for your interest in V8 Sim House! Here&rsquo;s everything you need to know about bringing the racing experience to your event.</p>
        <hr class="divider">
        <div class="label">Event Type</div>
        <div class="value">${data.eventType}</div>
        <div class="label">Event Date</div>
        <div class="value">${displayDate}</div>
        <hr class="divider">
        <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Our Packages</p>
        ${PACKAGE_TABLE}
        <hr class="divider">
        <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Optional Add-Ons</p>
        ${buildAddonsList(data.addons)}
        <hr class="divider">
        <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">How Payment Works</p>
        <ul style="margin:0;padding-left:20px;color:#aaa;line-height:2;">
          <li>30% deposit due at booking confirmation (non-refundable)</li>
          <li>70% balance automatically charged on your event day</li>
          <li>$300 refundable damage deposit collected on arrival</li>
        </ul>
        <hr class="divider">
        <p style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">What&rsquo;s Included</p>
        ${WHATS_INCLUDED}
        <hr class="divider">
        <p style="color:#aaa;font-size:13px;margin:0;">Ready when you are &mdash; your date is not reserved until a booking is confirmed.</p>
        <a href="${resumeUrl}" class="btn">Complete My Booking &rarr;</a>
      </div>`
    ),
  });
}

export async function sendSaveForLaterEmail(data: {
  firstName: string;
  email: string;
  leadId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.v8simhouse.com";
  const resumeUrl = `${appUrl}/book?lead=${data.leadId}`;

  return getResend().emails.send({
    from: FROM,
    to: data.email,
    subject: "Your V8 Sim booking progress has been saved",
    html: baseTemplate(
      "Your progress is saved!",
      `<div class="card">
        <p>Hi ${data.firstName},</p>
        <p>We&rsquo;ve saved your booking progress. Click the button below whenever you&rsquo;re ready to pick up right where you left off &mdash; works on any device.</p>
        <a href="${resumeUrl}" class="btn">Continue My Booking &rarr;</a>
        <hr class="divider">
        <p style="color:#555;font-size:12px;">Questions? Reach us at <a href="mailto:support@v8simhouse.com" style="color:#d32027;">support@v8simhouse.com</a></p>
      </div>`
    ),
  });
}

export async function sendLeadReminder3Week(data: {
  firstName: string;
  email: string;
  eventType: string;
  eventDate: string;
  selectedPackage: string | null;
  leadId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.v8simhouse.com";
  const displayDate = formatEventDate(data.eventDate);
  const resumeUrl = `${appUrl}/book?lead=${data.leadId}`;
  const pkg = data.selectedPackage ? PACKAGE_DISPLAY[data.selectedPackage] : null;

  const pricingBlock = pkg
    ? `<div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:16px;margin:16px 0;">
        <div class="label">Selected Package</div>
        <div class="value">${pkg.label} — ${pkg.price}</div>
        <div class="label">Deposit to secure your date</div>
        <div class="value">${pkg.deposit}</div>
      </div>`
    : `<div style="background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:16px;margin:16px 0;">
        ${PACKAGE_TABLE}
      </div>`;

  return getResend().emails.send({
    from: FROM,
    to: data.email,
    subject: `Your event is 3 weeks away — is your entertainment sorted? 🏎️`,
    html: baseTemplate(
      "3 Weeks to Go!",
      `<div class="card">
        <p>Hi ${data.firstName},</p>
        <p>Your <strong>${data.eventType}</strong> is coming up on <strong>${displayDate}</strong> &mdash; just 3 weeks away!</p>
        <p>If you&rsquo;ve been thinking about booking the V8 Sim experience, now is the perfect time. Dates fill up fast on weekends, and we want to make sure we can be there for your event.</p>
        <p style="color:#aaa;">Your pricing is still locked in:</p>
        ${pricingBlock}
        <p style="color:#aaa;font-size:13px;">It takes less than 5 minutes to complete your booking &mdash; and your date isn&rsquo;t reserved until it&rsquo;s confirmed.</p>
        <a href="${resumeUrl}" class="btn">Secure My Date Now &rarr;</a>
        <hr class="divider">
        <p style="color:#555;font-size:12px;">See you at the finish line &mdash; The V8 Sim House Team</p>
      </div>`
    ),
  });
}

export async function sendLeadReminder1Week(data: {
  firstName: string;
  email: string;
  eventType: string;
  eventDate: string;
  leadId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://book.v8simhouse.com";
  const displayDate = formatEventDate(data.eventDate);
  const resumeUrl = `${appUrl}/book?lead=${data.leadId}`;

  return getResend().emails.send({
    from: FROM,
    to: data.email,
    subject: `One week to go — your date is still open ⚠️`,
    html: baseTemplate(
      "One Week Away",
      `<div class="card">
        <p>Hi ${data.firstName},</p>
        <p>Your <strong>${data.eventType}</strong> is one week away on <strong>${displayDate}</strong>.</p>
        <p>We wanted to reach out one last time &mdash; your date is still available, but we can only hold it for confirmed bookings.</p>
        <p>If you&rsquo;re ready to make it happen, here&rsquo;s what to do:</p>
        <a href="${resumeUrl}" class="btn">Complete My Booking in 5 Minutes &rarr;</a>
        <hr class="divider">
        <p style="color:#555;font-size:12px;">If your plans changed and you no longer need us, no worries at all &mdash; just ignore this and have a great event either way!</p>
        <p style="color:#555;font-size:12px;">The V8 Sim House Team &mdash; Connecticut, USA &mdash; support@v8simhouse.com</p>
      </div>`
    ),
  });
}

// ─── Booking reminder (existing) ─────────────────────────────────────────────

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
