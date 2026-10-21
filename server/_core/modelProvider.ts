import { ENV } from "./env";

type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export type ProviderStatus = {
  configured: boolean;
  baseUrl: string | null;
  model: string | null;
};

const providerBaseUrl = () =>
  (process.env.NEXA_PROVIDER_BASE_URL ?? "").replace(/\/$/, "");
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
) {
  const status = getProviderStatus();
  if (!status.configured) {
    const error = new Error("NEXA_PROVIDER_NOT_CONFIGURED");
    error.name = "ProviderNotConfigured";
    throw error;
  }

  const response = await fetch(`${status.baseUrl}/chat/completions`, {
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
  });
  const body = (await response.json().catch(() => ({}))) as ProviderResponse;
  if (!response.ok)
    throw new Error(
      body.error?.message || `Provider request failed: ${response.status}`
    );
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Provider returned an empty response");
  return content;
}
