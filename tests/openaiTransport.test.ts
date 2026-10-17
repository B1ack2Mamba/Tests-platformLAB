import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner resolves explicit TypeScript files.
import { getOpenAIConnection, getOpenAIRequestConfig, resolveOpenAIModel } from "../lib/openaiTransport.ts";

test("existing deployments keep the direct Responses endpoint and exact model", () => {
  assert.deepEqual(getOpenAIRequestConfig("gpt-5.6-terra", { OPENAI_API_KEY: "direct-test-key" }), {
    provider: "openai", apiKey: "direct-test-key", baseUrl: "https://api.openai.com/v1",
    url: "https://api.openai.com/v1/responses", model: "gpt-5.6-terra",
  });
});

test("Timeweb uses its own key and explicitly configured model ID", () => {
  const config = getOpenAIRequestConfig("gpt-5.6-sol", {
    OPENAI_PROVIDER: "timeweb", OPENAI_API_KEY: "must-not-be-forwarded", TIMEWEB_AI_API_KEY: "gateway-test-key",
    TIMEWEB_AI_MODEL_MAP: JSON.stringify({ "gpt-5.6-sol": "verified/gpt-5.6-sol" }),
  });
  assert.equal(config?.url, "https://api.timeweb.ai/v1/responses");
  assert.equal(config?.apiKey, "gateway-test-key");
  assert.equal(config?.model, "verified/gpt-5.6-sol");
});

test("Timeweb never falls back to direct credentials", () => {
  assert.equal(getOpenAIConnection({ OPENAI_PROVIDER: "timeweb", OPENAI_API_KEY: "direct-test-key" }), null);
});

test("direct OpenAI never uses the Timeweb key", () => {
  assert.equal(getOpenAIConnection({ TIMEWEB_AI_API_KEY: "gateway-test-key" }), null);
  assert.equal(getOpenAIConnection({ OPENAI_API_KEY: "  " }), null);
});

test("unknown providers fail closed", () => {
  assert.throws(() => getOpenAIConnection({ OPENAI_PROVIDER: "typo" }), /OPENAI_PROVIDER/);
});

test("missing mappings cannot silently change a GPT model", () => {
  assert.throws(() => resolveOpenAIModel("gpt-5.6-sol", { OPENAI_PROVIDER: "timeweb" }), /missing a valid ID/);
  assert.throws(() => resolveOpenAIModel("gpt-5.6-sol", {
    OPENAI_PROVIDER: "timeweb", TIMEWEB_AI_MODEL_MAP: '{"gpt-5.6-terra":"some-model"}',
  }), /missing a valid ID/);
});

test("malformed maps fail without echoing their potentially sensitive contents", () => {
  for (const map of ["sensitive-invalid-json", "null", "[]", "123"]) {
    assert.throws(() => resolveOpenAIModel("gpt-5.6-sol", {
      OPENAI_PROVIDER: "timeweb", TIMEWEB_AI_MODEL_MAP: map,
    }), (error: Error) => /must be a JSON object/.test(error.message) && !error.message.includes(map));
  }
});

test("non-string, blank and whitespace-containing model IDs are rejected", () => {
  for (const id of [null, 7, "", "  ", "invalid model"]) {
    assert.throws(() => resolveOpenAIModel("gpt-5.6-sol", {
      OPENAI_PROVIDER: "timeweb", TIMEWEB_AI_MODEL_MAP: JSON.stringify({ "gpt-5.6-sol": id }),
    }), /missing a valid ID/);
  }
});

test("direct deployments ignore gateway mappings", () => {
  assert.equal(resolveOpenAIModel("gpt-5.6-terra", { TIMEWEB_AI_MODEL_MAP: "invalid" }), "gpt-5.6-terra");
});
