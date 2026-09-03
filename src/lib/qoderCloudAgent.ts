const QODER_BASE = "https://api.qoder.com/api/v1/cloud";
const STREAM_TIMEOUT_MS = 90_000;
const IDLE_TIMEOUT_MS = 20_000;

export type AgentResponse = {
  searchQuery?: string;
  summary?: string;
  productHints?: string[];
  model?: string;
  overallScore?: number;
  overallSummary?: string;
  pairs?: Array<{
    productAId?: string;
    productBId?: string;
    score?: number;
    matches?: boolean;
    insight?: string;
  }>;
  recommendations?: string[];
};

function extractJsonObject(text: string) {
  const clean = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : null;
}

export async function qoderFetch(
  pat: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${QODER_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qoder ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

export async function createSession(
  pat: string,
  agentId: string,
  envId: string,
  version?: string | number,
  title = "GenieAI Chat",
): Promise<string> {
  const agent: Record<string, unknown> = { id: agentId, type: "agent" };
  if (version !== undefined && version !== null && version !== "") {
    agent.version = version;
  }
  const res = await qoderFetch(pat, "/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent,
      environment_id: envId,
      title,
    }),
  });
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Qoder session create: no id returned");
  return data.id;
}

export async function sendTextMessage(
  pat: string,
  sessionId: string,
  text: string,
): Promise<void> {
  await qoderFetch(pat, `/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text }],
        },
      ],
    }),
  });
}

export async function sendImageMessage(
  pat: string,
  sessionId: string,
  dataUrl: string,
  prompt = 'Analyze this image and respond with ONLY a JSON object: {"searchQuery":"2-4 word product search query","summary":"one concise sentence"}. Focus on what gift or product the image suggests.',
): Promise<void> {
  await qoderFetch(pat, `/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({
      events: [
        {
          type: "user.message",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: dataUrl },
          ],
        },
      ],
    }),
  });
}

export async function readAssistantText(
  pat: string,
  sessionId: string,
): Promise<string> {
  const controller = new AbortController();
  const hardTimer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  const url = `${QODER_BASE}/sessions/${sessionId}/events/stream`;
  console.log(`[qoder] stream start session=${sessionId}`);

  let eventCount = 0;
  let textEventCount = 0;
  const knownTypes = new Set<string>();

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Qoder stream ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let completed = false;

    const logEvent = (raw: Record<string, unknown>) => {
      eventCount += 1;
      const eventType = String(raw.type ?? raw.event ?? "unknown");
      knownTypes.add(eventType);
      const content = collectTextFromContent(raw.content ?? raw.message);
      if (content) textEventCount += 1;
      if (eventCount <= 5) {
        const preview = JSON.stringify(raw).slice(0, 240);
        console.log(
          `[qoder] event#${eventCount} session=${sessionId} type=${eventType} textLen=${content.length} preview=${preview}`,
        );
      }
    };

    while (!completed) {
      const readWithIdleTimeout = (): Promise<{ done: boolean; value?: Uint8Array }> => {
        return new Promise((resolve, reject) => {
          const idleTimer = setTimeout(() => {
            controller.abort();
            reject(new Error("idle-timeout"));
          }, IDLE_TIMEOUT_MS);
          reader.read().then(
            (result) => {
              clearTimeout(idleTimer);
              resolve(result);
            },
            (err) => {
              clearTimeout(idleTimer);
              reject(err);
            },
          );
        });
      };

      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await readWithIdleTimeout());
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[qoder] stream aborted session=${sessionId} reason=${reason} collected=${text.length}chars`,
        );
        return text;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload) as Record<string, unknown>;
            logEvent(event);
            const eventType = String(event.type ?? event.event ?? "");

            if (
              eventType === "session.status_idle" ||
              eventType === "session.completed" ||
              eventType === "session.complete" ||
              event.completed === true
            ) {
              const stopReason = (event as Record<string, unknown>).stop_reason
                ?? (event as Record<string, unknown>).data;
              const stopType =
                stopReason && typeof stopReason === "object"
                  ? (stopReason as Record<string, unknown>).type
                  : undefined;
              if (
                eventType === "session.completed" ||
                eventType === "session.complete" ||
                event.completed === true ||
                stopType === "end_turn" ||
                stopType === "stop_sequence" ||
                stopType === "tool_use" ||
                stopType === "max_tokens"
              ) {
                completed = true;
              } else if (eventType === "session.status_idle") {
                completed = true;
              }
            }

            const content = collectTextFromContent(event.content ?? event.message);
            if (content) text += content;
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    console.log(
      `[qoder] stream end session=${sessionId} chars=${text.length} events=${eventCount} textEvents=${textEventCount} types=${[...knownTypes].join(",")}`,
    );
    return text;
  } catch (err) {
    if (controller.signal.aborted) {
      console.warn(
        `[qoder] stream aborted session=${sessionId} reason=hard-timeout-or-abort events=${eventCount} types=${[...knownTypes].join(",") || "none"}`,
      );
      return "";
    }
    throw err;
  } finally {
    clearTimeout(hardTimer);
  }
}

export function collectTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  let out = "";
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    if (p.type === "text" && typeof p.text === "string") {
      out += p.text;
    } else if (typeof p.text === "string") {
      out += p.text;
    }
  }
  return out;
}

export function parseAgentJson(text: string): AgentResponse {
  const json = extractJsonObject(text);
  if (!json) return { searchQuery: text.trim(), summary: text.trim() };
  try {
    return JSON.parse(json) as AgentResponse;
  } catch {
    return { searchQuery: text.trim(), summary: text.trim() };
  }
}
