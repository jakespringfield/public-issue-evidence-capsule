# Public Issue Evidence Capsule

A free, zero-dependency GitHub Action that turns one **public GitHub issue URL** into a deterministic factual evidence capsule. It records issue metadata, labels, assignees, aggregate activity, issue-timeline event counts, public pull request references, and explicit API coverage gaps.

The action is AI-independent and records facts only. It does not test code, interpret whether a bug reproduces, define an acceptance boundary, or recommend a next step. It uses no AI, telemetry, analytics, or external service other than GitHub's own REST API.

This project is published by Jake Springfield, the public-facing business alias for Springfield Systems. OpenAI Codex materially assists its analysis, implementation, testing, and drafting under owner-set limits. It is not operated, sponsored, or endorsed by OpenAI.

![A captured Public Issue Evidence Capsule showing selected metadata, labels, activity, and coverage gaps](docs/capsule-preview.png)

[Review the full captured Markdown example](EXAMPLE.md). It is a dated, point-in-time output from a real public issue, not a reproduction claim.

## Independent listing

[Public Issue Evidence Capsule is listed on Tiny Tool Town](https://www.tinytooltown.com/tools/public-issue-evidence-capsule/). The third-party listing confirms publication of the project entry only; it does not imply usage, endorsement, payment, or a customer relationship.

## Use it

No checkout step is required.

```yaml
name: Public issue evidence

on:
  workflow_dispatch:
    inputs:
      issue-url:
        description: Public GitHub issue URL
        required: true

permissions: {}

jobs:
  capsule:
    runs-on: ubuntu-latest
    steps:
      - name: Capture public issue evidence
        id: evidence
        uses: jakespringfield/public-issue-evidence-capsule@v1
        with:
          issue-url: ${{ inputs.issue-url }}

      - name: Show outputs
        run: |
          echo "Report: ${{ steps.evidence.outputs.report-path }}"
          echo "Evidence status: ${{ steps.evidence.outputs.evidence-status }}"
```

For production, pin the action to a reviewed full 40-character commit SHA instead of a mutable tag. Keep a comment beside the SHA showing the human-readable release, and use Dependabot or an equivalent reviewed process for updates.

Unauthenticated GitHub REST requests work for public resources but have lower rate limits. To authenticate requests after the public visibility gate, explicitly pass a token with only the access you intend:

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: read

steps:
  - uses: jakespringfield/public-issue-evidence-capsule@v1
    with:
      issue-url: https://github.com/owner/repository/issues/123
      github-token: ${{ github.token }}
```

## Outputs and files

The action always writes `public-issue-evidence.md` in the job workspace and appends the same Markdown to `GITHUB_STEP_SUMMARY`.

| Output | Values | Meaning |
| --- | --- | --- |
| `report-path` | `public-issue-evidence.md` | Relative path to the report. |
| `evidence-status` | `SNAPSHOT_READY`, `API_INCOMPLETE` | Whether all selected API requests and safety-limited pages completed. This reflects API coverage only. |

Invalid input, a non-public target, or failure to retrieve the issue writes an `API_INCOMPLETE` report and fails the step. A partial timeline or linked-PR response writes the available facts, sets `API_INCOMPLETE`, and leaves the step available for downstream handling.

## Exact scope

The implementation uses the current date-versioned GitHub REST API (`2026-03-10`) and these read-only endpoints:

- `GET /repos/{owner}/{repo}` without credentials, as a public visibility gate
- `GET /repos/{owner}/{repo}/issues/{number}`
- `GET /repos/{owner}/{repo}/issues/{number}/timeline`
- `GET /repos/{owner}/{repo}/pulls/{number}` for public PR cross-references found in the timeline

Public visibility is independently checked without a token before any repository is included. Even when a token is supplied, a PR reference whose repository cannot be verified as public is omitted without printing its identity. The action intentionally does not support private repositories.

Only selected metadata is written. Issue bodies, comment bodies, commit messages, and pull request bodies are not written to the report. Timeline requests exclude `commented` and `committed` payloads. The REST timeline reliably exposes PR cross-references, but a manually connected event may not identify the counterpart, so that limitation is stated rather than guessed around.

The action never clones or checks out a target repository and never builds, imports, installs, or executes its code. It performs no write request to GitHub. API-derived text is encoded as inert Markdown text, including image syntax, HTML, table delimiters, and code delimiters.

There is no telemetry, tracking pixel, analytics endpoint, vendor API, or hosted processing service. GitHub receives the REST requests because GitHub is the source of the requested public evidence. See [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and [SUPPORT.md](SUPPORT.md) for the operational boundaries.

GitHub references: [REST API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions), [issues](https://docs.github.com/en/rest/issues/issues), [timeline events](https://docs.github.com/en/rest/issues/timeline), and [pull requests](https://docs.github.com/en/rest/pulls/pulls).

## Local tests

No install is needed because there are no runtime or development dependencies.

```shell
npm test
```

Tests use mocked `fetch` responses and make no network requests.

## When a factual capsule is not enough

The free Action records facts and missing fields. The optional [$29 Public Bug Evidence Decision Brief](https://moltgate.com/jakespringfield/public-bug-evidence-decision-brief/) is a separate service for one public, non-security GitHub bug. It interprets supplied same-repository public evidence and returns a source-linked evidence status, the decisive evidence and gap, one bounded acceptance-test proposal, and a `GO`, `NO-GO`, or `NEEDS-INPUT` next action. It does not execute code or independently reproduce the reported failure. The free Action remains complete on its own, and purchase is not required to use it.

## License

[MIT](LICENSE). A separate [EULA](EULA.md) restates runtime and warranty terms without narrowing the MIT software grant.
