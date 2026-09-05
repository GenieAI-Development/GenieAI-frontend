const BACKEND_HEALTH_URL = "https://genieai-backend.vercel.app/healthz";

export async function GET() {
  try {
    await fetch(BACKEND_HEALTH_URL, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    // Best-effort warm-up: intentionally ignore backend failures.
  }

  return new Response(null, { status: 204 });
}
