import { templateLookupResult } from "./workshop-template-result.js";
import {
  lookupTemplate,
  lookupDocumentInput,
  templatePrompt,
  lookupDocuments,
} from "./workshop-lookup-template.js";
// AI-assisted Workshop product lookup. This endpoint creates a draft only.
import { reserveLookupAttempt } from "./ai-lookup-quota.js";
import { accountUser } from "./accounts.js";
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
const text = (v, n = 200) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
const MODEL = "gpt-5.4";
// Standard OpenAI API rates in USD. Output usage includes reasoning tokens.
const TOKEN_RATES = { input: 2.5, cached: 0.25, output: 15 };
const WEB_SEARCH_RATE = 0.01;
function estimateLookupUsage(payload) {
  const usage = payload.usage;
  const input = usage?.input_tokens,
    output = usage?.output_tokens,
    cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  if (
    ![input, output, cached].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    cached > input
  )
    return null;
  const searches = (payload.output || []).filter(
    (item) => item.type === "web_search_call" && item.action?.type === "search",
  ).length;
  const tokenCostPerMillion =
    (input - cached) * TOKEN_RATES.input +
    cached * TOKEN_RATES.cached +
    output * TOKEN_RATES.output;
  const estimatedUsd =
    (tokenCostPerMillion + searches * WEB_SEARCH_RATE * 1e6) / 1e6;
  return {
    estimatedUsd,
    searches,
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);
  const user = await accountUser(request, env);
  if (user?.role !== "admin")
    return json({ error: "Sign in to use AI part lookup" }, 401);
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin)
    return json({ error: "Invalid request origin" }, 403);
  if (env.AI_LOOKUP_ENABLED !== "1")
    return json(
      {
        error: "AI lookup is paused. You can still enter details manually.",
        code: "AI_PAUSED",
      },
      503,
    );
  if (!env.OPENAI_API_KEY)
    return json(
      {
        error: "AI lookup is not configured for this environment.",
        code: "AI_NOT_CONFIGURED",
      },
      503,
    );
  const body = await request.json().catch(() => null);
  let template, documentInputs, sourceDocuments;
  try {
    template = await lookupTemplate(env, body);
    sourceDocuments = await lookupDocuments(
      env,
      body?.productId,
      body?.document,
    );
    documentInputs = sourceDocuments.map(lookupDocumentInput);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const partNumber = text(body?.partNumber, 160),
    partName = text(body?.partName, 180),
    manufacturer = text(body?.manufacturer, 160),
    searchHint = text(body?.searchHint, 500);
  if (!searchHint)
    return json(
      { error: "Enter a search hint before looking up product specs." },
      400,
    );
  if (!partNumber && !partName)
    return json(
      { error: "Enter a part name or manufacturer part number." },
      400,
    );
  if (
    partNumber &&
    !/^[A-Za-z0-9][A-Za-z0-9._+ #()/\-]{0,159}$/.test(partNumber)
  )
    return json({ error: "Enter a valid manufacturer part number." }, 400);
  if (!env.PHOTOS) return json({ error: "Workshop storage unavailable" }, 503);
  try {
    await reserveLookupAttempt(env.PHOTOS, user.id);
  } catch (error) {
    return json(
      { error: error.message, code: error.code || "AI_USAGE_UNAVAILABLE" },
      error.status || 503,
    );
  }
  const prompt = templatePrompt(template, {
    partNumber,
    manufacturer,
    partName,
    searchHint,
  });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        authorization: "Bearer " + env.OPENAI_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "low" },
        max_output_tokens: 6000,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        input: documentInputs.length
          ? [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text:
                      prompt +
                      "\nDocument sources: " +
                      JSON.stringify(
                        sourceDocuments.map((d) => ({
                          id: d.id,
                          name: d.name,
                        })),
                      ),
                  },
                  ...documentInputs,
                ],
              },
            ]
          : prompt,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code =
        typeof payload.error?.code === "string" &&
        /^[a-z0-9_]{1,100}$/i.test(payload.error.code)
          ? payload.error.code
          : "unknown";
      console.error("Workshop lookup provider error", response.status, code);
      if (
        [
          "organization_spend_limit_exceeded",
          "project_spend_limit_exceeded",
          "organization_usage_limit_exceeded",
          "credit_balance_exhausted",
          "insufficient_quota",
        ].includes(code)
      )
        return json(
          {
            error:
              "Your OpenAI spending or credit limit has been reached. Enter details manually, or wait for your limit to reset.",
            code: "AI_SPEND_LIMIT",
          },
          429,
        );
      if (response.status === 429)
        return json(
          {
            error: "AI lookup is busy. Wait a moment before trying again.",
            code: "AI_RATE_LIMIT",
          },
          429,
        );
      if ([401, 403].includes(response.status))
        return json(
          {
            error: "AI lookup needs its API key or model permissions checked.",
            code: "AI_CONFIGURATION",
          },
          503,
        );
      return json(
        {
          error:
            "Product lookup is unavailable. Try again later or enter details manually.",
          code: "AI_PROVIDER_ERROR",
        },
        502,
      );
    }
    const lookupUsage = estimateLookupUsage(payload);
    const raw = (payload.output || [])
      .filter((v) => v.type === "message")
      .flatMap((v) => v.content || [])
      .filter((v) => v.type === "output_text")
      .map((v) => v.text)
      .join("\n");
    const stripped = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    let data;
    try {
      data = JSON.parse(stripped);
    } catch {
      return json(
        {
          error:
            "The lookup did not return usable product details. Try again or enter the item manually.",
          lookupUsage,
        },
        502,
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      return json(
        { error: "Product lookup returned invalid details", lookupUsage },
        502,
      );
    try {
      return json(
        await templateLookupResult(
          data,
          template,
          { partNumber, manufacturer, documents: sourceDocuments },
          lookupUsage,
        ),
      );
    } catch (error) {
      return json({ error: error.message, lookupUsage }, 422);
    }
  } catch (error) {
    console.error("Workshop lookup failed", error?.name || "TransportError");
    return json(
      {
        error:
          "Product lookup failed. Try again or enter the details manually.",
      },
      502,
    );
  }
}
