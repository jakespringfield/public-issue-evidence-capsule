# Security policy

## Safe use

- Pin this Action and every third-party Action to a reviewed full 40-character commit SHA. Record the corresponding release in a comment and review updates before changing the SHA.
- Start with `permissions: {}` for unauthenticated public use. If rate limits require `github-token`, grant read-only `contents: read`, `issues: read`, and `pull-requests: read` permissions only.
- Do not pass a personal token when the job-provided GitHub token is sufficient. Never place a token directly in workflow source or an issue URL.
- Treat the generated report as untrusted public input if another tool consumes it. The Action encodes Markdown control characters, but downstream parsers still need their own validation.

The Action makes only GitHub REST `GET` requests. It does not invoke a shell, clone or check out the target, install target dependencies, or execute target repository content. Repository visibility is checked without credentials before any repository is included.

## Reporting a vulnerability

Do not publish credentials, exploit details, or private repository data in a public issue. Use the published repository's private vulnerability reporting channel under its Security tab. If that channel is unavailable, ask the maintainer for a private reporting route without including sensitive details in the request.

Include the Action commit SHA, runner type, minimal reproduction, expected boundary, and whether the report exposed content that should have remained inert. Remove all tokens and private data.
