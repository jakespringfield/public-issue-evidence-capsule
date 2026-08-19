'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const form = fs.readFileSync(
  path.join(root, '.github', 'ISSUE_TEMPLATE', 'brief-scope-review.yml'),
  'utf8',
);
const config = fs.readFileSync(
  path.join(root, '.github', 'ISSUE_TEMPLATE', 'config.yml'),
  'utf8',
);
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const report = fs.readFileSync(path.join(root, 'src', 'report.js'), 'utf8');

test('public scope-review intake is structured, non-binding, and privacy bounded', () => {
  assert.match(form, /name: \$29 Public Bug Evidence Decision Brief scope review/);
  assert.match(form, /This issue and later edits are public and may be indexed/);
  assert.match(form, /creates no order, payment obligation, reservation, or work/i);
  assert.match(form, /does not link to checkout/i);
  assert.match(form, /Jake-only Moltgate profile/i);
  assert.match(form, /OpenAI Codex materially assists/i);
  assert.match(form, /no separate human review is included/i);
  assert.match(form, /At \$29 USD, I have purchase intent if this public scope is eligible; checkout terms are accepted separately/);
  assert.match(form, /one public, non-security bug in one public repository/i);
  assert.deepEqual(
    [...form.matchAll(/^\s+id: ([a-z_]+)$/gm)].map((match) => match[1]),
    ['repository_url', 'issue_url', 'target_decision', 'price_intent', 'boundaries'],
  );
  assert.equal((form.match(/^  - type: input$/gm) ?? []).length, 2);
  assert.equal((form.match(/^  - type: dropdown$/gm) ?? []).length, 2);
  assert.equal((form.match(/^  - type: checkboxes$/gm) ?? []).length, 1);
  assert.equal((form.match(/required: true/g) ?? []).length, 9);
  assert.doesNotMatch(
    form,
    /type: textarea|type: upload|mailto:|tel:|environment_version|desired_outcome|supporting_url|email address:\s|phone|company|payout|tax|default:/i,
  );
  assert.match(form, /does not execute code, independently reproduce, patch, comment/);
  assert.equal(
    config,
    'blank_issues_enabled: true\n' +
      'contact_links:\n' +
      '  - name: Security-reporting boundary\n' +
      '    url: https://github.com/jakespringfield/public-issue-evidence-capsule/blob/main/SECURITY.md\n' +
      '    about: Do not disclose vulnerabilities here. This intake accepts only public, non-security bug evidence.\n',
  );
});

test('owned README routes through preflight while generated reports stay non-promotional', () => {
  const scopeReviewUrl =
    'https://github.com/jakespringfield/public-issue-evidence-capsule/issues/new?template=brief-scope-review.yml';
  const preflightUrl =
    'https://springfield-systems.jakespringfield1.workers.dev/public-bug-decision-brief/preflight';
  assert.match(readme, new RegExp(preflightUrl.replace(/[.?]/g, '\\$&')));
  assert.doesNotMatch(readme, new RegExp(scopeReviewUrl.replace(/[.?]/g, '\\$&')));
  assert.doesNotMatch(report, new RegExp(scopeReviewUrl.replace(/[.?]/g, '\\$&')));
  assert.doesNotMatch(readme, /moltgate\.com\/jakespringfield/i);
  assert.doesNotMatch(report, /moltgate\.com\/jakespringfield/i);
  assert.match(readme, /The only URLs requested there are the public repository and issue URLs/i);
  assert.match(readme, /Only an eligible result reveals the verified checkout/i);
  assert.doesNotMatch(report, /\$29|Moltgate|scope review|checkout|preflight|paid brief|purchase/i);
});
