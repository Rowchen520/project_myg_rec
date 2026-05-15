const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.NOTIFICATION_REMINDER_CRON_TOKEN?.trim();

if (!token) {
  throw new Error("Missing NOTIFICATION_REMINDER_CRON_TOKEN environment variable.");
}

const response = await fetch(`${baseUrl}/api/notifications/reminders/overdue`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  throw new Error(`Overdue notification reminder failed with status ${response.status}: ${payload.error ?? "unknown error"}`);
}

console.log(JSON.stringify(payload));