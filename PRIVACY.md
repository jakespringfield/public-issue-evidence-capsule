# Privacy

Public Issue Evidence Capsule is designed for public GitHub data only.

## Data processed

The Action receives a public GitHub issue URL and, only if the user explicitly supplies it, a GitHub token. It calls `api.github.com` for the verified public repository, issue, timeline, and public pull request metadata described in the README.

The token is held in runner process memory long enough to send authorized requests to already verified public paths. It is never written to the report, step summary, outputs, or logs. Public visibility checks never include the token. The Action rejects a non-public target and omits a PR reference whose repository cannot be verified as public without credentials.

## Storage and sharing

Processing occurs on the user's GitHub Actions runner. The Action writes `public-issue-evidence.md`, the GitHub step summary, and two GitHub Action outputs. Repository and workflow settings control log, artifact, and summary retention.

There is no AI runtime, telemetry, analytics, tracking pixel, or non-GitHub vendor endpoint in the Action. The only network destination in the Action code is GitHub's REST API. GitHub processes those requests under the user's relationship with GitHub.

## Data minimization

The report includes selected public metadata only. It excludes issue bodies, comment bodies, commit messages, and pull request bodies. Timeline requests exclude commented and committed event payloads. API-derived text is encoded before being written to Markdown.

## Public scope-review intake

The optional scope-review route is a public GitHub issue form, separate from Action execution. GitHub sign-in is required. The submitter's GitHub username, the two public GitHub URLs, fixed-option selections, confirmations, issue history, and later edits are public and are processed and retained by GitHub under GitHub's policies. Editing or deleting an issue does not guarantee removal from GitHub history, caches, or third-party indexes.

Springfield Systems uses a submitted form only to revalidate public visibility and scope, reply publicly with an eligibility result, and record non-binding price intent. The form is not an order, payment, reservation, or start of work. The public issue can be reviewed without creating a separate local copy. GitHub's copy, issue history, caches, and third-party indexes remain subject to GitHub and those third parties rather than this repository's Action runtime.

Do not submit names, email addresses, credentials, private or personal data, customer data, private links, logs, attachments, unpublished code, security or vulnerability details, or financial information.
