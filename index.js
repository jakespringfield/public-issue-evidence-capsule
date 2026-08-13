'use strict';

const { runAction } = require('./src/action');

runAction().catch((error) => {
  process.stderr.write(`Public Issue Evidence Capsule failed unexpectedly: ${error.message}\n`);
  process.exitCode = 1;
});
