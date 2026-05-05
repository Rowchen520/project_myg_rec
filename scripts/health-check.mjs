const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`);

if (!response.ok) {
  throw new Error(`Health check failed with status ${response.status}`);
}

const payload = await response.json();

if (!payload.ok) {
  throw new Error("Health check response did not contain ok=true");
}

console.log(`Health check passed for ${payload.service}`);
