# Support

Public Issue Evidence Capsule supports public `https://github.com/OWNER/REPO/issues/NUMBER` URLs on GitHub-hosted or compatible runners with the Node.js 24 Action runtime.

Before requesting support:

1. Confirm the target is a public issue, not a pull request.
2. Check whether `evidence-status` is `API_INCOMPLETE` and read the report's evidence gaps.
3. Retry without a token to distinguish public visibility from token-permission behavior.
4. Run `npm test` against the exact Action commit.

Open a support issue in the repository where this Action is published. Include the Action commit SHA, public issue URL, runner operating system, evidence status, and redacted error text. Never include tokens, private URLs, private issue content, or complete workflow logs that may contain secrets.

Support covers defects in the factual capsule. Interpretation of current status, reproduction evidence, acceptance boundaries, and recommended next steps is intentionally outside the free Action's scope.
