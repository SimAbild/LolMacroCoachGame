// Carries out a list of changes on GitHub with gh: one write about every second, and a stop at
// the first error. A rerun only does what is left, because the next run compares again.
import { gh } from './githubState.mjs';
import { describeChange } from './planChanges.mjs';

const PAUSE_BETWEEN_WRITES_MS = 1000;
const ISSUE_NUMBER_IN_URL = /\/issues\/(\d+)\s*$/;

const MILESTONES = 'repos/{owner}/{repo}/milestones';

const HANDLERS = {
  'create-label': ({ label }) => writeLabel('create', label),
  'update-label': ({ label }) => writeLabel('edit', label),
  'create-milestone': ({ milestone }) => write(['api', '--method', 'POST', MILESTONES, '--input', '-'], JSON.stringify(milestone)),
  'update-milestone': updateMilestone,
  'create-issue': createIssue,
  'update-issue': updateIssue,
  'close-issue': closeIssue,
  'reopen-issue': reopenIssue,
  'create-papercut': async (change, hooks) => hooks.onPapercutNumber(change.row, await createIssue(change)),
  'link-papercut': async (change, hooks) => hooks.onPapercutNumber(change.row, change.number),
};

// hooks.onPapercutNumber(row, number) writes a new papercut issue's number back into its row.
export async function applyChanges(changes, hooks = {}) {
  for (const [index, change] of changes.entries()) {
    try {
      await HANDLERS[change.kind](change, hooks);
    } catch (error) {
      // Stop here and say how far the run got; the next run compares again and does only the rest.
      throw new Error(`stopped at "${describeChange(change)}" after ${index} of ${changes.length} changes: ${error.message}`);
    }
    console.log(`  done ${index + 1}/${changes.length}: ${describeChange(change)}`);
  }
}

function writeLabel(verb, label) {
  return write(['label', verb, label.name, '--color', label.color, '--description', label.description]);
}

async function updateMilestone({ title, number, patch }) {
  const milestoneNumber = number ?? await milestoneNumberOf(title);
  return write(['api', '--method', 'PATCH', `${MILESTONES}/${milestoneNumber}`, '--input', '-'], JSON.stringify(patch));
}

async function milestoneNumberOf(title) {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `${MILESTONES}?state=all&per_page=100`]));
  const milestone = pages.flat().find(candidate => candidate.title === title);
  if (!milestone) throw new Error(`no milestone titled "${title}"`);
  return milestone.number;
}

// An issue that must end up closed is created, then closed; the number is printed in between, so
// a stop during the close still shows that the issue exists.
async function createIssue({ issue }) {
  const labels = issue.labels.flatMap(label => ['--label', label]);
  const milestone = issue.milestone ? ['--milestone', issue.milestone] : [];
  const args = ['issue', 'create', '--title', issue.title, '--body-file', '-', ...milestone, ...labels];
  const url = await write(args, issue.body);
  const number = Number(url.match(ISSUE_NUMBER_IN_URL)?.[1]);
  if (!number) throw new Error(`gh issue create did not print an issue URL: ${url.trim()}`);
  console.log(`    created #${number}`);
  if (issue.state === 'closed') await closeIssue({ number, issue });
  return number;
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
  console.log(`    reopened #${number}`);
  if (issue.reopenComment) await write(['issue', 'comment', String(number), '--body-file', '-'], issue.reopenComment);
}

async function write(args, input) {
  await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_WRITES_MS));
  return gh(args, input);
}
