'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { runAction } = require('../src/action');
const { renderReport } = require('../src/report');
const { InputError, ScopeError, collectSnapshot, parseIssueUrl } = require('../src/snapshot');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function fixtureIssue(overrides = {}) {
  return {
    number: 7,
    title: 'Pipe | title <safe>',
    state: 'open',
    state_reason: null,
    user: { login: 'octocat' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
    closed_at: null,
    locked: false,
    comments: 2,
    milestone: null,
    labels: [{ name: 'zeta' }, { name: 'Bug' }],
    assignees: [{ login: 'zoe' }, { login: 'Ada' }],
    ...overrides,
  };
}

function fixturePull(overrides = {}) {
  return {
    number: 9,
    title: 'Fix the public issue',
    state: 'closed',
    draft: false,
    merged: true,
    merged_at: '2026-01-02T12:00:00Z',
    user: { login: 'contributor' },
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T12:00:00Z',
    closed_at: '2026-01-02T12:00:00Z',
    ...overrides,
  };
}

function publicSnapshotFetch(callLog = []) {
  return async (url, options) => {
    callLog.push({ url, options });
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') {
      return response(200, { full_name: 'acme/widget', private: false });
    }
    if (parsed.pathname === '/repos/acme/widget/issues/7' && !parsed.pathname.endsWith('/timeline')) {
      return response(200, fixtureIssue());
    }
    if (parsed.pathname === '/repos/acme/widget/issues/7/timeline') {
      return response(200, [
        { event: 'labeled' },
        {
          event: 'cross-referenced',
          source: {
            issue: {
              html_url: 'https://github.com/acme/widget/pull/9',
              pull_request: { url: 'https://api.github.com/repos/acme/widget/pulls/9' },
            },
          },
        },
      ]);
    }
    if (parsed.pathname === '/repos/acme/widget/pulls/9') return response(200, fixturePull());
    throw new Error(`Unexpected mock URL: ${url}`);
  };
}

test('parseIssueUrl accepts only canonical GitHub issue URLs', () => {
  assert.deepEqual(parseIssueUrl('https://github.com/acme/widget/issues/7'), {
    owner: 'acme',
    repo: 'widget',
    number: 7,
  });
  assert.throws(() => parseIssueUrl('https://github.com/acme/widget/pull/7'), InputError);
  assert.throws(() => parseIssueUrl('https://example.com/acme/widget/issues/7'), InputError);
  assert.throws(() => parseIssueUrl('https://github.com/acme/widget/issues/7?source=test'), InputError);
  assert.throws(() => parseIssueUrl('https://github.com/acme/widget/issues/7/'), InputError);
  assert.throws(() => parseIssueUrl('https://github.com/acme//widget/issues/7'), InputError);
});

test('collectSnapshot uses the current REST version, keeps the public gate unauthenticated, and renders deterministic facts', async () => {
  const calls = [];
  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    token: 'explicit-test-token',
    fetchImpl: publicSnapshotFetch(calls),
  });

  assert.equal(snapshot.evidenceStatus, 'SNAPSHOT_READY');
  assert.deepEqual(snapshot.issue.labels, ['Bug', 'zeta']);
  assert.deepEqual(snapshot.issue.assignees, ['Ada', 'zoe']);
  assert.equal(snapshot.pullRequests[0].merged, true);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer explicit-test-token');
  assert.ok(calls.every((call) => call.options.headers['X-GitHub-Api-Version'] === '2026-03-10'));
  assert.match(calls[2].url, /exclude=commented%2Ccommitted/);

  const firstReport = renderReport(snapshot);
  const secondReport = renderReport(snapshot);
  assert.equal(firstReport, secondReport);
  assert.match(firstReport, /\| Title \| Pipe &#124; title &lt;safe&gt; \|/);
  assert.match(firstReport, /acme\/widget#9/);
  assert.doesNotMatch(firstReport, /\$29|Moltgate|brief-scope-review|paid interpretation|purchase/i);
  assert.doesNotMatch(firstReport, /recommendation|acceptance verdict|next-step advice/i);
});

test('hostile Markdown from GitHub is rendered as inert text', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') return response(200, { full_name: 'acme/widget', private: false });
    if (parsed.pathname === '/repos/acme/widget/issues/7') {
      return response(200, fixtureIssue({
        title: '![tracking](https://example.invalid/pixel) <img src=x> @octocat #123 www.example.invalid',
        labels: [{ name: '`break`' }, { name: 'type: bug' }],
      }));
    }
    if (parsed.pathname.endsWith('/timeline')) return response(200, []);
    throw new Error(`Unexpected mock URL: ${url}`);
  };

  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    fetchImpl,
  });
  const report = renderReport(snapshot);

  assert.doesNotMatch(report, /!\[tracking\]|<img/);
  assert.doesNotMatch(report, /https:\/\/example\.invalid|@octocat|#123|www\.example\.invalid/);
  assert.match(report, /&#33;&#91;tracking&#93;\(https&#58;\/\/example&#46;invalid\/pixel\)/);
  assert.match(report, /&#96;break&#96;/);
  assert.match(report, /- type&#58; bug/);
  assert.doesNotMatch(report, /`type&#58; bug`/);
});

test('partial API results are reported as API_INCOMPLETE without inventing a decision', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') return response(200, { full_name: 'acme/widget', private: false });
    if (parsed.pathname === '/repos/acme/widget/issues/7') return response(200, fixtureIssue({ labels: [], assignees: [] }));
    if (parsed.pathname.endsWith('/timeline')) return response(503, { message: 'unavailable' });
    throw new Error(`Unexpected mock URL: ${url}`);
  };

  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    fetchImpl,
  });
  const report = renderReport(snapshot);

  assert.equal(snapshot.evidenceStatus, 'API_INCOMPLETE');
  assert.match(report, /timeline stopped after 0 retained events when page 1 could not be retrieved \(HTTP 503\)/);
  assert.match(report, /No labels are present/);
  assert.doesNotMatch(report, /No public PR cross-reference was found/);
  assert.doesNotMatch(report, /next step|acceptance criteria|reproduce this/i);
  assert.doesNotMatch(report, /Moltgate|Public Bug Evidence Decision Brief/i);
});

test('a later timeline page failure retains earlier factual evidence', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') return response(200, { full_name: 'acme/widget', private: false });
    if (parsed.pathname === '/repos/acme/widget/issues/7') return response(200, fixtureIssue());
    if (parsed.pathname.endsWith('/timeline') && parsed.searchParams.get('page') === '1') {
      return response(200, Array.from({ length: 100 }, (_, index) => ({ event: index === 0 ? 'labeled' : 'referenced' })));
    }
    if (parsed.pathname.endsWith('/timeline') && parsed.searchParams.get('page') === '2') {
      return response(503, { message: 'unavailable' });
    }
    throw new Error(`Unexpected mock URL: ${url}`);
  };

  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    fetchImpl,
  });

  assert.equal(snapshot.evidenceStatus, 'API_INCOMPLETE');
  assert.equal(snapshot.timeline.eventCount, 100);
  assert.deepEqual(snapshot.timeline.counts, [
    { event: 'labeled', count: 1 },
    { event: 'referenced', count: 99 },
  ]);
  assert.match(snapshot.gaps.join('\n'), /stopped after 100 retained events when page 2 could not be retrieved/);
});

test('an exact 1000-event timeline is not falsely marked truncated', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') return response(200, { full_name: 'acme/widget', private: false });
    if (parsed.pathname === '/repos/acme/widget/issues/7') return response(200, fixtureIssue());
    if (parsed.pathname.endsWith('/timeline')) {
      const page = Number(parsed.searchParams.get('page'));
      return response(200, page <= 10 ? Array.from({ length: 100 }, () => ({ event: 'referenced' })) : []);
    }
    throw new Error(`Unexpected mock URL: ${url}`);
  };

  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    fetchImpl,
  });

  assert.equal(snapshot.evidenceStatus, 'SNAPSHOT_READY');
  assert.equal(snapshot.timeline.eventCount, 1000);
  assert.doesNotMatch(snapshot.gaps.join('\n'), /safety limit/);
});

test('a private repository is rejected before a token is sent', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(200, { full_name: 'acme/private-widget', private: true });
  };

  await assert.rejects(
    collectSnapshot({
      issueUrl: 'https://github.com/acme/private-widget/issues/1',
      token: 'private-scope-token',
      fetchImpl,
    }),
    ScopeError,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('runAction does not echo a private repository identity after public-scope rejection', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'private-issue-evidence-'));
  const summaryPath = path.join(temporaryDirectory, 'summary.md');
  const outputPath = path.join(temporaryDirectory, 'outputs.txt');
  fs.writeFileSync(summaryPath, '', 'utf8');
  fs.writeFileSync(outputPath, '', 'utf8');

  try {
    const result = await runAction({
      cwd: temporaryDirectory,
      env: {
        'INPUT_ISSUE-URL': 'https://github.com/secret/private-widget/issues/1',
        'INPUT_GITHUB-TOKEN': 'private-scope-token',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: outputPath,
      },
      fetchImpl: async () => response(404, { message: 'Not Found' }),
    });

    const combined = `${result.report}\n${fs.readFileSync(summaryPath, 'utf8')}`;
    assert.equal(result.evidenceStatus, 'API_INCOMPLETE');
    assert.doesNotMatch(combined, /secret|private-widget/);
    assert.match(combined, /Not echoed in failure output/);
    assert.doesNotMatch(combined, /Moltgate|Public Bug Evidence Decision Brief/i);
  } finally {
    process.exitCode = 0;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('a non-public cross-reference is omitted without exposing its identity', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    if (parsed.pathname === '/repos/acme/widget') return response(200, { full_name: 'acme/widget', private: false });
    if (parsed.pathname === '/repos/acme/widget/issues/7') return response(200, fixtureIssue());
    if (parsed.pathname.endsWith('/timeline')) {
      return response(200, [{
        event: 'cross-referenced',
        source: {
          issue: {
            pull_request: { url: 'https://api.github.com/repos/secret/private-widget/pulls/4' },
          },
        },
      }]);
    }
    if (parsed.pathname === '/repos/secret/private-widget') return response(404, { message: 'Not Found' });
    throw new Error(`Unexpected mock URL: ${url}`);
  };

  const snapshot = await collectSnapshot({
    issueUrl: 'https://github.com/acme/widget/issues/7',
    token: 'explicit-test-token',
    fetchImpl,
  });
  const report = renderReport(snapshot);
  const visibilityCall = calls.find((call) => call.url.endsWith('/repos/secret/private-widget'));

  assert.equal(snapshot.evidenceStatus, 'API_INCOMPLETE');
  assert.equal(visibilityCall.options.headers.Authorization, undefined);
  assert.doesNotMatch(report, /secret|private-widget/);
  assert.match(report, /omitted because the repository could not be independently verified as public/);
  assert.doesNotMatch(report, /Moltgate|Public Bug Evidence Decision Brief/i);
});

test('runAction writes the report, step summary, and declared outputs using mocked fetch', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'public-issue-evidence-'));
  const summaryPath = path.join(temporaryDirectory, 'summary.md');
  const outputPath = path.join(temporaryDirectory, 'outputs.txt');
  fs.writeFileSync(summaryPath, '', 'utf8');
  fs.writeFileSync(outputPath, '', 'utf8');

  try {
    const result = await runAction({
      cwd: temporaryDirectory,
      env: {
        'INPUT_ISSUE-URL': 'https://github.com/acme/widget/issues/7',
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: outputPath,
      },
      fetchImpl: publicSnapshotFetch(),
    });

    assert.equal(result.evidenceStatus, 'SNAPSHOT_READY');
    assert.equal(fs.readFileSync(path.join(temporaryDirectory, 'public-issue-evidence.md'), 'utf8'), result.report);
    assert.equal(fs.readFileSync(summaryPath, 'utf8'), result.report);
    assert.equal(
      fs.readFileSync(outputPath, 'utf8'),
      'report-path=public-issue-evidence.md\nevidence-status=SNAPSHOT_READY\n',
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
