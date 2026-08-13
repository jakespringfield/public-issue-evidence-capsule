'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { collectSnapshot } = require('./snapshot');
const { renderFailureReport, renderReport } = require('./report');

const REPORT_NAME = 'public-issue-evidence.md';

function appendIfConfigured(filePath, content) {
  if (!filePath) return;
  fs.appendFileSync(filePath, content, 'utf8');
}

function setOutputs(outputPath, evidenceStatus) {
  appendIfConfigured(outputPath, `report-path=${REPORT_NAME}\nevidence-status=${evidenceStatus}\n`);
}

async function runAction({ env = process.env, cwd = process.cwd(), fetchImpl = globalThis.fetch } = {}) {
  const issueUrl = String(env['INPUT_ISSUE-URL'] || env.INPUT_ISSUE_URL || '').trim();
  const token = String(env['INPUT_GITHUB-TOKEN'] || env.INPUT_GITHUB_TOKEN || '').trim();
  let evidenceStatus = 'API_INCOMPLETE';
  let report;
  let fatalError = null;

  try {
    const snapshot = await collectSnapshot({ issueUrl, token, fetchImpl });
    evidenceStatus = snapshot.evidenceStatus;
    report = renderReport(snapshot);
  } catch (error) {
    fatalError = error;
    report = renderFailureReport(issueUrl, error);
  }

  const reportPath = path.join(cwd, REPORT_NAME);
  fs.writeFileSync(reportPath, report, 'utf8');
  appendIfConfigured(env.GITHUB_STEP_SUMMARY, report);
  setOutputs(env.GITHUB_OUTPUT, evidenceStatus);

  if (fatalError) {
    process.stderr.write(`Public Issue Evidence Capsule failed: ${fatalError.message}\n`);
    process.exitCode = 1;
  } else if (evidenceStatus === 'API_INCOMPLETE') {
    process.stderr.write('Public Issue Evidence Capsule completed with incomplete API coverage.\n');
  } else {
    process.stdout.write(`Public issue evidence written to ${REPORT_NAME}.\n`);
  }

  return { evidenceStatus, fatalError, report, reportPath };
}

module.exports = { REPORT_NAME, runAction, setOutputs };
