// Carries out a list of changes on GitHub with gh: one write about every second, and a stop at
// the first error. A rerun only does what is left, because the next run compares again.
import { gh } from './githubState.mjs';
import { describeChange } from './planChanges.mjs';

const PAUSE_BETWEEN_WRITES_MS = 1000;
const ISSUE_NUMBER_IN_URL = /\/issues\/(\d+)\s*$/;

const HANDLERS = {
  'create-label': ({ label }) => write(['label', 'create', label.name, '--color', label.color, '--description', label.description]),
  'update-label': ({ label }) => write(['label', 'edit', label.name, '--color', label.color, '--description', label.description]),
  'create-milestone': ({ milestone }) => write(['api', '--method', 'POST', 'repos/{owner}/{repo}/milestones', '--input', '-'], JSON.stringify(milestone)),
  'update-milestone': updateMilestone,
  'create-issue': createIssue,
  'update-issue': updateIssue,
  'close-issue': closeIssue,
  'reopen-issue': reopenIssue,
};

export async function applyChanges(changes) {
  for (const [index, change] of changes.entries()) {
    try {
      await HANDLERS[change.kind](change);
    } catch (error) {
      throw new Error(`stopped at "${describeChange(change)}" after ${index} of ${changes.length} changes: ${error.message}`);
    }
    console.log(`  done ${index + 1}/${changes.length}: ${describeChange(change)}`);
  }
}

function updateMilestone({ number, milestone, fields }) {
  const patch = Object.fromEntries(fields.map(field => [field, milestone[field]]));
  return write(['api', '--method', 'PATCH', `repos/{owner}/{repo}/milestones/${number}`, '--input', '-'], JSON.stringify(patch));
}

async function createIssue({ issue }) {
  const labels = issue.labels.flatMap(label => ['--label', label]);
  const url = await write(['issue', 'create', '--title', issue.title, '--body-file', '-', '--milestone', issue.milestone, ...labels], issue.body);
  const number = Number(url.match(ISSUE_NUMBER_IN_URL)?.[1]);
  if (!number) throw new Error(`gh issue create did not print an issue URL: ${url.trim()}`);
  if (issue.state === 'closed') await closeIssue({ number, issue });
}

async function updateIssue({ number, issue, fields, addLabels, removeLabels }) {
  const args = ['issue', 'edit', String(number)];
  if (fields.includes('title')) args.push('--title', issue.title);
  if (fields.includes('body')) args.push('--body-file', '-');
  if (fields.includes('milestone')) args.push('--milestone', issue.milestone);
  for (const label of addLabels) args.push('--add-label', label);
  for (const label of removeLabels) args.push('--remove-label', label);
  await write(args, fields.includes('body') ? issue.body : undefined);
}

// The comment goes through stdin, so text from the plan never reaches gh as an argument it parses.
async function closeIssue({ number, issue }) {
  await write(['issue', 'comment', String(number), '--body-file', '-'], issue.closeComment);
  await write(['issue', 'close', String(number), '--reason', issue.stateReason === 'not_planned' ? 'not planned' : 'completed']);
}

// When an issue is only reopened to be closed with another reason, the close carries the comment.
async function reopenIssue({ number, issue }) {
  await write(['issue', 'reopen', String(number)]);
  if (issue.reopenComment) await write(['issue', 'comment', String(number), '--body-file', '-'], issue.reopenComment);
}

async function write(args, input) {
  await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_WRITES_MS));
  return gh(args, input);
}
