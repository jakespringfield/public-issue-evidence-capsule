# End User License Agreement

Effective date: August 12, 2026

This End User License Agreement applies to use of Public Issue Evidence Capsule as a GitHub Action. The software itself is licensed under the [MIT License](LICENSE). Nothing in this agreement narrows the rights granted by the MIT License; if software-license terms conflict, the MIT License controls.

## Operation

The Action is a self-contained workflow component, not a hosted evidence or advisory service. It runs on the user's selected GitHub Actions runner, makes read-only requests to GitHub's REST API, and writes files and workflow metadata in that job. The user controls the workflow, runner, token permissions, retention, and downstream use of the report.

The Action provides a machine-generated factual capsule from selected public API fields. It does not provide legal, security, engineering, or commercial advice. It does not promise that GitHub's API exposes every relationship or that a captured issue is reproducible, accepted, actionable, or complete.

## User responsibilities

The user must supply only public issue URLs they are permitted to process, protect any token, grant least privilege, review workflow dependencies, and validate the report before relying on it. The Action must not be used to bypass GitHub access controls or process private repositories.

## No warranty or service commitment

The software is provided without warranty under the MIT License. There is no uptime, support-response, evidence-completeness, or outcome guarantee. GitHub availability, API behavior, rate limits, and runner behavior are outside the maintainer's control.

The optional paid decision packet linked from the README is a separate offer with its own posted scope and terms. Using the free Action does not purchase, enroll in, or require that service.
