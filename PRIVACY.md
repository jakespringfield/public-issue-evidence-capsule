# Privacy

Public Issue Evidence Capsule is designed for public GitHub data only.

## Data processed

The Action receives a public GitHub issue URL and, only if the user explicitly supplies it, a GitHub token. It calls `api.github.com` for the verified public repository, issue, timeline, and public pull request metadata described in the README.

The token is held in runner process memory long enough to send authorized requests to already verified public paths. It is never written to the report, step summary, outputs, or logs. Public visibility checks never include the token. The Action rejects a non-public target and omits a PR reference whose repository cannot be verified as public without credentials.

## Storage and sharing

Processing occurs on the user's GitHub Actions runner. The Action writes `public-issue-evidence.md`, the GitHub step summary, and two GitHub Action outputs. Repository and workflow settings control log, artifact, and summary retention.

There is no AI, telemetry, analytics, tracking pixel, vendor endpoint, or hosted processing service. The only network destination in the Action code is GitHub's REST API. GitHub processes those requests under the user's relationship with GitHub.

## Data minimization

The report includes selected public metadata only. It excludes issue bodies, comment bodies, commit messages, and pull request bodies. Timeline requests exclude commented and committed event payloads. API-derived text is encoded before being written to Markdown.
