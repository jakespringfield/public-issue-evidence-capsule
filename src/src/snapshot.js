'use strict';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const MAX_TIMELINE_PAGES = 10;
const MAX_PR_REFERENCES = 50;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

class ApiError extends Error {
  constructor(resource, status = null) {
    const suffix = status === null ? 'a network error' : `HTTP ${status}`;
    super(`${resource} could not be retrieved (${suffix}).`);
    this.name = 'ApiError';
    this.resource = resource;
    this.status = status;
  }
}

class ScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScopeError';
  }
}

function compareText(left, right) {
  const a = String(left).toLowerCase();
  const b = String(right).toLowerCase();
  if (a < b) return -1;
  if (a > b) return 1;
  const originalA = String(left);
  const originalB = String(right);
  if (originalA < originalB) return -1;
  if (originalA > originalB) return 1;
  return 0;
}

function parseIssueUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new InputError('issue-url must be a valid https://github.com issue URL.');
  }

  if (
    parsed.protocol !== 'https:'
    || parsed.hostname.toLowerCase() !== 'github.com'
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new InputError('issue-url must use https://github.com.');
  }

  const match = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9]\d*)$/.exec(parsed.pathname);
  if (!match) {
    throw new InputError('issue-url must have the form https://github.com/OWNER/REPO/issues/NUMBER.');
  }

  const [, owner, repo, numberText] = match;

  return { owner, repo, number: Number(numberText) };
}

function parseRepositoryName(fullName) {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(String(fullName || ''));
  return match ? { owner: match[1], repo: match[2] } : null;
}

function parsePullReference(issue) {
  if (!issue || !issue.pull_request) return null;

  const apiUrl = String(issue.pull_request.url || '');
  let match = /^https:\/\/api\.github\.com\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pulls\/([1-9]\d*)$/.exec(apiUrl);
  if (match) {
    return { owner: match[1], repo: match[2], number: Number(match[3]) };
  }

  const htmlUrl = String(issue.html_url || issue.pull_request.html_url || '');
  match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)\/?$/.exec(htmlUrl);
  if (match) {
    return { owner: match[1], repo: match[2], number: Number(match[3]) };
  }

  return null;
}

function pullReferenceKey(reference) {
  return `${reference.owner.toLowerCase()}/${reference.repo.toLowerCase()}#${reference.number}`;
}

function extractPullReferences(events) {
  const references = new Map();
  let malformedCount = 0;

  for (const event of events) {
    if (!event || event.event !== 'cross-referenced') continue;
    const sourceIssue = event.source && event.source.issue;
    if (!sourceIssue || !sourceIssue.pull_request) continue;
    const reference = parsePullReference(sourceIssue);
    if (!reference) {
      malformedCount += 1;
      continue;
    }
    references.set(pullReferenceKey(reference), reference);
  }

  return {
    malformedCount,
    references: [...references.values()].sort((left, right) => {
      const repositoryOrder = compareText(`${left.owner}/${left.repo}`, `${right.owner}/${right.repo}`);
      return repositoryOrder || left.number - right.number;
    }),
  };
}

function requestHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'public-issue-evidence-capsule-action',
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestJson(fetchImpl, url, { token = '', resource = 'GitHub API resource' } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: requestHeaders(token),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(20_000)
        : undefined,
    });
  } catch {
    throw new ApiError(resource);
  }

  if (!response || !response.ok) {
    throw new ApiError(resource, response && Number.isInteger(response.status) ? response.status : null);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(resource, response.status);
  }
}

async function verifyPublicRepository(fetchImpl, owner, repo) {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  let repository;
  try {
    repository = await requestJson(fetchImpl, `${API_ROOT}/repos/${encodedOwner}/${encodedRepo}`, {
      resource: `Public repository ${owner}/${repo}`,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ScopeError(`The requested repository could not be verified as public (${error.status === null ? 'network error' : `HTTP ${error.status}`}).`);
    }
    throw error;
  }

  const canonical = parseRepositoryName(repository.full_name);
  if (repository.private !== false || !canonical) {
    throw new ScopeError('The requested repository is not a verified public GitHub repository.');
  }

  return { ...canonical, fullName: `${canonical.owner}/${canonical.repo}` };
}

async function fetchTimeline(fetchImpl, repository, issueNumber, token) {
  const events = [];
  for (let page = 1; page <= MAX_TIMELINE_PAGES; page += 1) {
    const query = new URLSearchParams({
      per_page: '100',
      page: String(page),
      exclude: 'commented,committed',
    });
    let pageEvents;
    try {
      pageEvents = await requestJson(
        fetchImpl,
        `${API_ROOT}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/issues/${issueNumber}/timeline?${query}`,
        { token, resource: `Issue timeline page ${page}` },
      );
      if (!Array.isArray(pageEvents)) throw new ApiError(`Issue timeline page ${page}`, 200);
    } catch (error) {
      const status = error instanceof ApiError && error.status !== null ? `HTTP ${error.status}` : 'a network error';
      return { events, truncated: false, failure: { page, status } };
    }
    events.push(...pageEvents);
    if (pageEvents.length < 100) return { events, truncated: false, failure: null };
  }

  const sentinelPage = MAX_TIMELINE_PAGES + 1;
  const sentinelQuery = new URLSearchParams({
    per_page: '100',
    page: String(sentinelPage),
    exclude: 'commented,committed',
  });
  try {
    const sentinelEvents = await requestJson(
      fetchImpl,
      `${API_ROOT}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/issues/${issueNumber}/timeline?${sentinelQuery}`,
      { token, resource: `Issue timeline page ${sentinelPage}` },
    );
    if (!Array.isArray(sentinelEvents)) throw new ApiError(`Issue timeline page ${sentinelPage}`, 200);
    return { events, truncated: sentinelEvents.length > 0, failure: null };
  } catch (error) {
    const status = error instanceof ApiError && error.status !== null ? `HTTP ${error.status}` : 'a network error';
    return { events, truncated: false, failure: { page: sentinelPage, status } };
  }
}

function eventCounts(events) {
  const counts = new Map();
  for (const event of events) {
    const name = event && typeof event.event === 'string' && event.event ? event.event : 'unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => compareText(left[0], right[0]))
    .map(([event, count]) => ({ event, count }));
}

function normalizeIssue(issue, repository, issueNumber) {
  return {
    repository: repository.fullName,
    number: issueNumber,
    url: `https://github.com/${repository.owner}/${repository.repo}/issues/${issueNumber}`,
    title: typeof issue.title === 'string' ? issue.title : '',
    state: typeof issue.state === 'string' ? issue.state : 'unknown',
    stateReason: typeof issue.state_reason === 'string' ? issue.state_reason : null,
    author: issue.user && typeof issue.user.login === 'string' ? issue.user.login : null,
    createdAt: issue.created_at || null,
    updatedAt: issue.updated_at || null,
    closedAt: issue.closed_at || null,
    locked: issue.locked === true,
    comments: Number.isInteger(issue.comments) ? issue.comments : null,
    milestone: issue.milestone && typeof issue.milestone.title === 'string' ? issue.milestone.title : null,
    labels: Array.isArray(issue.labels)
      ? issue.labels
        .map((label) => (typeof label === 'string' ? label : label && label.name))
        .filter((label) => typeof label === 'string' && label)
        .sort(compareText)
      : [],
    assignees: Array.isArray(issue.assignees)
      ? issue.assignees
        .map((assignee) => assignee && assignee.login)
        .filter((login) => typeof login === 'string' && login)
        .sort(compareText)
      : [],
  };
}

function normalizePullRequest(pull, reference, repository) {
  return {
    available: true,
    repository: repository.fullName,
    number: reference.number,
    url: `https://github.com/${repository.owner}/${repository.repo}/pull/${reference.number}`,
    title: typeof pull.title === 'string' ? pull.title : '',
    state: typeof pull.state === 'string' ? pull.state : 'unknown',
    draft: pull.draft === true,
    merged: pull.merged === true || Boolean(pull.merged_at),
    author: pull.user && typeof pull.user.login === 'string' ? pull.user.login : null,
    createdAt: pull.created_at || null,
    updatedAt: pull.updated_at || null,
    closedAt: pull.closed_at || null,
    mergedAt: pull.merged_at || null,
  };
}

async function collectSnapshot({ issueUrl, token = '', fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') throw new InputError('A Fetch API implementation is required.');
  const parsed = parseIssueUrl(issueUrl);
  const targetRepository = await verifyPublicRepository(fetchImpl, parsed.owner, parsed.repo);

  const issue = await requestJson(
    fetchImpl,
    `${API_ROOT}/repos/${encodeURIComponent(targetRepository.owner)}/${encodeURIComponent(targetRepository.repo)}/issues/${parsed.number}`,
    { token, resource: `Issue ${targetRepository.fullName}#${parsed.number}` },
  );
  if (issue && issue.pull_request) {
    throw new InputError('issue-url points to a pull request. Supply a GitHub issue URL instead.');
  }

  const gaps = [];
  let incomplete = false;
  let timelineEvents = [];
  let timelineTruncated = false;
  let timelineFailed = false;

  try {
    const timeline = await fetchTimeline(fetchImpl, targetRepository, parsed.number, token);
    timelineEvents = timeline.events;
    timelineTruncated = timeline.truncated;
    if (timeline.failure) {
      incomplete = true;
      timelineFailed = true;
      gaps.push(`The issue timeline stopped after ${timeline.events.length} retained events when page ${timeline.failure.page} could not be retrieved (${timeline.failure.status}); later activity and PR-reference coverage are incomplete.`);
    }
    if (timelineTruncated) {
      incomplete = true;
      gaps.push(`Timeline retrieval reached the ${MAX_TIMELINE_PAGES * 100}-event safety limit; later events are not included.`);
    }
  } catch (error) {
    incomplete = true;
    const status = error instanceof ApiError && error.status !== null ? `HTTP ${error.status}` : 'a network error';
    gaps.push(`The issue timeline was not fully retrieved (${status}); activity and PR-reference coverage are incomplete.`);
  }

  const extracted = extractPullReferences(timelineEvents);
  if (extracted.malformedCount > 0) {
    incomplete = true;
    gaps.push(`${extracted.malformedCount} PR cross-reference ${extracted.malformedCount === 1 ? 'entry was' : 'entries were'} not usable because the REST response lacked a valid public PR URL.`);
  }

  let references = extracted.references;
  if (references.length > MAX_PR_REFERENCES) {
    incomplete = true;
    gaps.push(`Only the first ${MAX_PR_REFERENCES} of ${references.length} PR cross-references are included.`);
    references = references.slice(0, MAX_PR_REFERENCES);
  }

  const publicRepositoryCache = new Map([
    [targetRepository.fullName.toLowerCase(), targetRepository],
  ]);
  const pullRequests = [];
  let redactedReferenceCount = 0;

  for (const reference of references) {
    const requestedName = `${reference.owner}/${reference.repo}`;
    const cacheKey = requestedName.toLowerCase();
    let publicRepository = publicRepositoryCache.get(cacheKey);
    if (!publicRepository) {
      try {
        publicRepository = await verifyPublicRepository(fetchImpl, reference.owner, reference.repo);
        publicRepositoryCache.set(cacheKey, publicRepository);
      } catch {
        incomplete = true;
        redactedReferenceCount += 1;
        continue;
      }
    }

    try {
      const pull = await requestJson(
        fetchImpl,
        `${API_ROOT}/repos/${encodeURIComponent(publicRepository.owner)}/${encodeURIComponent(publicRepository.repo)}/pulls/${reference.number}`,
        { token, resource: `Pull request ${publicRepository.fullName}#${reference.number}` },
      );
      pullRequests.push(normalizePullRequest(pull, reference, publicRepository));
    } catch (error) {
      incomplete = true;
      const status = error instanceof ApiError && error.status !== null ? `HTTP ${error.status}` : 'network error';
      pullRequests.push({
        available: false,
        repository: publicRepository.fullName,
        number: reference.number,
        url: `https://github.com/${publicRepository.owner}/${publicRepository.repo}/pull/${reference.number}`,
        error: status,
      });
      gaps.push(`PR metadata for ${publicRepository.fullName}#${reference.number} was not retrieved (${status}).`);
    }
  }

  if (redactedReferenceCount > 0) {
    gaps.push(`${redactedReferenceCount} PR ${redactedReferenceCount === 1 ? 'reference was' : 'references were'} omitted because the repository could not be independently verified as public.`);
  }

  const normalizedIssue = normalizeIssue(issue, targetRepository, parsed.number);
  if (normalizedIssue.labels.length === 0) gaps.push('No labels are present on the issue.');
  if (normalizedIssue.assignees.length === 0) gaps.push('No assignees are present on the issue.');
  if (references.length === 0 && !timelineTruncated && !timelineFailed) {
    gaps.push('No public PR cross-reference was found in the fetched issue timeline.');
  }

  const counts = eventCounts(timelineEvents);
  const connectedCount = counts.find((entry) => entry.event === 'connected');
  if (connectedCount) {
    gaps.push(`${connectedCount.count} connected timeline ${connectedCount.count === 1 ? 'event does' : 'events do'} not identify a counterpart PR in the REST fields used by this action.`);
  }

  pullRequests.sort((left, right) => {
    const repositoryOrder = compareText(left.repository, right.repository);
    return repositoryOrder || left.number - right.number;
  });

  return {
    apiVersion: API_VERSION,
    authenticated: Boolean(token),
    evidenceStatus: incomplete ? 'API_INCOMPLETE' : 'SNAPSHOT_READY',
    issue: normalizedIssue,
    timeline: {
      eventCount: timelineEvents.length,
      counts,
      excludes: ['commented', 'committed'],
    },
    pullRequests,
    gaps,
  };
}

module.exports = {
  API_VERSION,
  ApiError,
  InputError,
  ScopeError,
  collectSnapshot,
  eventCounts,
  extractPullReferences,
  parseIssueUrl,
  requestJson,
};
