'use strict';

function escapeCell(value) {
  const entities = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\\': '&#92;', '|': '&#124;',
    '`': '&#96;', '!': '&#33;', '@': '&#64;', '#': '&#35;', ':': '&#58;',
    '.': '&#46;', '[': '&#91;', ']': '&#93;', '*': '&#42;', '_': '&#95;',
  };
  return String(value)
    .replace(/\r?\n|\r/g, ' ')
    .replace(/[&<>\\|`!@#:.\[\]*_]/g, (character) => entities[character]);
}

function display(value) {
  return value === null || value === undefined || value === '' ? 'Not set' : escapeCell(value);
}

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function list(values) {
  if (!values.length) return '- None\n';
  return `${values.map((value) => `- ${escapeCell(value)}`).join('\n')}\n`;
}

function renderReport(snapshot) {
  const issue = snapshot.issue;
  const lines = [
    '# Public Issue Evidence Capsule',
    '',
    `**Evidence status:** \`${snapshot.evidenceStatus}\``,
    '',
    'This deterministic capsule contains selected public GitHub metadata. It uses no AI and makes no reproduction, acceptance, or next-step decision.',
    '',
    '## Issue metadata',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Repository | ${escapeCell(issue.repository)} |`,
    `| Issue | [#${issue.number}](${issue.url}) |`,
    `| Title | ${display(issue.title)} |`,
    `| State | ${display(issue.state)} |`,
    `| State reason | ${display(issue.stateReason)} |`,
    `| Author | ${display(issue.author)} |`,
    `| Created | ${display(issue.createdAt)} |`,
    `| Updated | ${display(issue.updatedAt)} |`,
    `| Closed | ${display(issue.closedAt)} |`,
    `| Locked | ${yesNo(issue.locked)} |`,
    `| Comments | ${display(issue.comments)} |`,
    `| Milestone | ${display(issue.milestone)} |`,
    '',
    '## Labels',
    '',
    list(issue.labels).trimEnd(),
    '',
    '## Assignees',
    '',
    list(issue.assignees).trimEnd(),
    '',
    '## Public activity',
    '',
    `- Reported issue comment count: ${display(issue.comments)}`,
    `- Non-comment timeline events fetched: ${snapshot.timeline.eventCount}`,
    `- Latest issue update: ${display(issue.updatedAt)}`,
    '',
  ];

  if (snapshot.timeline.counts.length) {
    lines.push('| Timeline event | Count |', '| --- | ---: |');
    for (const entry of snapshot.timeline.counts) {
      lines.push(`| ${escapeCell(entry.event)} | ${entry.count} |`);
    }
  } else {
    lines.push('No non-comment timeline events were returned in the fetched pages.');
  }

  lines.push('', '## Linked pull request evidence', '');
  if (snapshot.pullRequests.length) {
    lines.push('| Pull request | Title | State | Draft | Merged | Updated |', '| --- | --- | --- | --- | --- | --- |');
    for (const pull of snapshot.pullRequests) {
      if (!pull.available) {
        lines.push(`| [${escapeCell(pull.repository)}#${pull.number}](${pull.url}) | Not available | API unavailable (${escapeCell(pull.error)}) | Not available | Not available | Not available |`);
        continue;
      }
      lines.push(`| [${escapeCell(pull.repository)}#${pull.number}](${pull.url}) | ${display(pull.title)} | ${display(pull.state)} | ${yesNo(pull.draft)} | ${yesNo(pull.merged)} | ${display(pull.updatedAt)} |`);
    }
  } else {
    lines.push('No public PR metadata is included.');
  }

  lines.push('', '## Evidence gaps', '');
  if (snapshot.gaps.length) {
    for (const gap of snapshot.gaps) lines.push(`- ${escapeCell(gap)}`);
  } else {
    lines.push('- None in the API fields covered by this capsule.');
  }

  lines.push(
    '',
    '## Scope and method',
    '',
    `- GitHub REST API version: \`${snapshot.apiVersion}\`.`,
    '- Public visibility is checked without credentials before a repository is included.',
    `- Subsequent requests to verified public paths were ${snapshot.authenticated ? 'authenticated with the explicitly supplied token' : 'unauthenticated'}.`,
    '- The report selects issue metadata, labels, assignees, aggregate activity, timeline event types, and public PR state fields.',
    '- Issue, comment, commit, and pull request body text is excluded from the report.',
    '- PR coverage is limited to public PR cross-references exposed by the issue timeline REST response. A manually connected event may not expose its counterpart.',
    '- The action does not clone, check out, build, import, or execute target repository code.',
    '',
  );

  if (snapshot.evidenceStatus === 'SNAPSHOT_READY') {
    lines.push(
      '## Optional paid interpretation',
      '',
      'Facts captured. The optional $29 Public Bug Evidence Decision Brief is temporarily unavailable while its seller account is migrated to the Jake-only account. Do not pay through any previous Moltgate link.',
      '',
      'The free Action is complete on its own. It does not diagnose, independently reproduce, or recommend a fix, and purchase is not required.',
      '',
    );
  }

  return lines.join('\n');
}

function renderFailureReport(_issueUrl, error) {
  const message = error && error.message ? error.message : 'The snapshot could not be completed.';
  return [
    '# Public Issue Evidence Capsule',
    '',
    '**Evidence status:** `API_INCOMPLETE`',
    '',
    '**Requested issue:** Not echoed in failure output.',
    '',
    '## Evidence gap',
    '',
    `- ${escapeCell(message)}`,
    '',
    'No repository code was cloned, checked out, imported, built, or executed.',
    '',
  ].join('\n');
}

module.exports = { escapeCell, renderFailureReport, renderReport };
