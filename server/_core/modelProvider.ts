type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string };
};

export type ProviderStatus = {
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
};

const providerBaseUrl = () =>
  (process.env.NEXA_PROVIDER_BASE_URL ?? "").trim().replace(/\/$/, "");
const providerKey = () => process.env.NEXA_PROVIDER_API_KEY ?? "";
const providerModel = () => process.env.NEXA_PROVIDER_MODEL ?? "";

export function getProviderStatus(): ProviderStatus {
  const baseUrl = providerBaseUrl();
  const model = providerModel();
  return {
    configured: Boolean(baseUrl && providerKey() && model),
    baseUrl: baseUrl || null,
    model: model || null,
  };
}

export async function requestProviderCompletion(
  messages: ProviderMessage[],
  extended = false
): Promise<string> {
  const status = getProviderStatus();
  if (!status.configured) {
    const error = new Error("NEXA_PROVIDER_NOT_CONFIGURED");
    error.name = "ProviderNotConfigured";
    throw error;
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${status.baseUrl}/chat/completions`);
  } catch {
    throw new Error("PROVIDER_INVALID_BASE_URL");
  }
  if (endpoint.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && endpoint.hostname === "localhost")) {
    throw new Error("PROVIDER_HTTPS_REQUIRED");
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${providerKey()}`,
      },
      body: JSON.stringify({
        model: status.model,
        messages,
        max_tokens: extended ? 4096 : 2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      const timeout = new Error("PROVIDER_TIMEOUT");
      timeout.name = "ProviderTimeout";
      throw timeout;
    }
    throw new Error("PROVIDER_CONNECTION_FAILED");
  }

  const body = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok) {
    const error = new Error(`PROVIDER_HTTP_${response.status}`);
    error.name = "ProviderRequestFailed";
    throw error;
  }
  const content = body.choices?.[0]?.message?.content;
  const normalized = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map(part => part.text ?? "").join("")
      : "";
  if (!normalized.trim()) throw new Error("PROVIDER_EMPTY_RESPONSE");
  return normalized.trim();
}
