// A lost response is not proof that a write failed. Callers retain drafts and
// replay identities; this module never retries or creates a new operation.
export async function requestResult(
  url,
  options = {},
  {
    fetcher = fetch,
    valid = (value) =>
      value && typeof value === "object" && !Array.isArray(value),
  } = {},
) {
  const writing = !["GET", "HEAD"].includes(options.method || "GET");
  let response;
  try {
    response = await fetcher(url, options);
  } catch (cause) {
    throw Object.assign(
      Error(
        (cause.message || "Connection interrupted.") +
          (writing
            ? " Save unconfirmed. Keep this tab open and retry the same action."
            : " Could not load. Try again."),
      ),
      { cause, uncertain: writing, code: "REQUEST_INTERRUPTED" },
    );
  }
  let value;
  try {
    value = await response.json();
  } catch {
    /* Classified below. */
  }
  if (!response.ok) {
    const uncertain = writing && response.status >= 500;
    const guidance =
      response.status === 401
        ? " Log in again; your draft is retained."
        : response.status === 409
          ? " Review the saved version before saving again; your draft is retained."
          : uncertain
            ? " Save unconfirmed. Keep this tab open and retry the same action."
            : writing
              ? " Changes were not confirmed. Your draft is retained."
              : " Try loading again.";
    throw Object.assign(
      Error(
        (value?.error || "Request failed (HTTP " + response.status + ").") +
          guidance,
      ),
      { status: response.status, code: value?.code, uncertain },
    );
  }
  if (!valid(value))
    throw Object.assign(
      Error(
        "The server response could not be read." +
          (writing
            ? " Save unconfirmed. Your draft is retained; retry the same action."
            : " Try loading again."),
      ),
      {
        status: response.status,
        code: "PROJECT_RESPONSE_UNREADABLE",
        uncertain: writing,
      },
    );
  return value;
}
