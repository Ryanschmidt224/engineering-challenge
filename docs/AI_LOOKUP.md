# Owner part lookup

The owner requested restoring Find with AI and reported an enforced $5 API spending cap. The earlier unconditional website pause returned 503 before contacting OpenAI; a provider spending setting alone could not remove that pause. This change enables only the existing owner-only part-lookup route, using `AI_LOOKUP_ENABLED=1`. The unrelated component-extraction route stays paused. The Workshop family/product redesign remains separate work.

No billing setting, API key, provider cap, model or price is changed. The application relies on the owner's existing enforced OpenAI cap for dollar spending. The website does not claim to enforce its own $5 ledger. OpenAI distinguishes an enforced hard limit from a spend alert and notes enforcement can lag tracked usage; configuration is managed in the owner's API project. No new administration key or billing access is requested.

Before a paid request, the handler validates the owner session, request origin, flag, API key and query. R2 reserves one of 15 daily attempts using conditional writes, so two tabs cannot share the final slot. Failed paid requests retain their reservation because an unsuccessful lookup may still incur a provider charge. A malformed query or missing key consumes no attempt. This daily request count supplements the provider cap; it is not a cost estimate or monthly budget.

Provider spending/credit failures return a clear 429 (`AI_SPEND_LIMIT`) with no automatic retry. Ordinary rate errors, invalid key/permissions, missing environment key and other provider failures have separate safe error codes. Diagnostics record status and a validated code only, never the raw provider message or credentials. A 45-second provider timeout bounds a hung call. Generated values are still suggestions; nothing saves automatically. Numeric zero and boolean specification values are retained.

Validation includes Worker-boundary owner/origin tests, default-off behavior, provider-cap errors, secret-free diagnostics, concurrent final-slot reservation, failed-attempt accounting and existing identity/source verification. Mocked provider tests do not establish a successful paid request using the actual Cloudflare key. That live check remains required before reporting the lookup operational.

Release: review this small API/configuration PR separately from the project-engine rewrite. With all checks green, the authorized deployment from main enables part lookup using the existing production key. Preview needs its own `OPENAI_API_KEY` secret for a real-provider check; secrets are not copied into the repository. Roll back by reverting this change or setting the flag to `0` and redeploying; retain the daily usage counters and do not raise the provider cap to make a test pass.

Current provider references checked November 22, 2026:
- https://developers.openai.com/api/docs/guides/spend-limits
- https://developers.openai.com/api/docs/models/gpt-5.4
