type Environment = Record<string, string | undefined>;

/** Server-side only. Provider credentials must never use NEXT_PUBLIC_ variables. */
export function getOpenAIProvider(env: Environment = process.env) {
  const provider = (env.OPENAI_PROVIDER || "openai").trim().toLowerCase();
  if (provider !== "openai" && provider !== "timeweb") {
    throw new Error("OPENAI_PROVIDER must be openai or timeweb.");
  }
  return provider;
}

export function getOpenAIConnection(env: Environment = process.env) {
  const provider = getOpenAIProvider(env);
  const keyName = provider === "timeweb" ? "TIMEWEB_AI_API_KEY" : "OPENAI_API_KEY";
  const apiKey = env[keyName]?.trim();
  if (!apiKey) return null;
  return {
    provider,
    apiKey,
    // Separate fixed origins prevent forwarding an OpenAI key to another provider.
    baseUrl: provider === "timeweb" ? "https://api.timeweb.ai/v1" : "https://api.openai.com/v1",
  };
}

export function resolveOpenAIModel(model: string, env: Environment = process.env) {
  if (getOpenAIProvider(env) === "openai") return model;

  // Gateway IDs are obtained from /models. Never guess aliases or replace a model.
  let mapping: unknown;
  try {
    mapping = JSON.parse(env.TIMEWEB_AI_MODEL_MAP || "{}");
  } catch {
    throw new Error("TIMEWEB_AI_MODEL_MAP must be a JSON object of exact model IDs.");
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error("TIMEWEB_AI_MODEL_MAP must be a JSON object of exact model IDs.");
  }
  const id = Object.prototype.hasOwnProperty.call(mapping, model)
    ? (mapping as Record<string, unknown>)[model]
    : undefined;
  if (typeof id !== "string" || !id.trim() || /\s/.test(id.trim())) {
    throw new Error(`TIMEWEB_AI_MODEL_MAP is missing a valid ID for ${model}. Verify it with the gateway model list.`);
  }
  return id.trim();
}

/** Keeps the existing Responses payload, prompts and token limits unchanged. */
export function getOpenAIRequestConfig(model: string, env: Environment = process.env) {
  const connection = getOpenAIConnection(env);
  if (!connection) return null;
  return {
    ...connection,
    url: `${connection.baseUrl}/responses`,
    model: resolveOpenAIModel(model, env),
  };
}
