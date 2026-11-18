// The --papercuts mode of tools/planToIssues.mjs: mirrors the open rows of PAPERCUTS.md as GitHub
// issues and closes them when a row turns fixed or accepted (R6 in specs/github-issues/spec.md).
import path from 'node:path';
import { papercutChanges, parsePapercuts } from './papercuts.mjs';
import { writeBackIssueNumber } from './papercutFile.mjs';
import { REPO_ROOT, readLabelDefinitions, readSourceFile, uncommittedReason } from './readPlan.mjs';
import { changeCount, describeChange, labelChanges } from './planChanges.mjs';
import { loadGithubState, refuseUnlessOwner } from './githubState.mjs';
import { applyChanges } from './applyChanges.mjs';

const DEFAULT_FILE = 'PAPERCUTS.md';
const LISTED_TEXT_LENGTH = 90;

export async function runPapercuts(options) {
  if (options.ref) throw new Error('--papercuts reads PAPERCUTS.md from the working tree, so --ref does not apply');
  const source = readSourceFile(options.paths[0] ?? DEFAULT_FILE, null);
  const { rows, problems } = parsePapercuts(source.text);
  const state = loadGithubState(options);
  const { changes, warnings } = papercutChanges(rows, state, { repoUrl: state.repoUrl, commit: source.commit });
  const allChanges = [...labelChanges(readLabelDefinitions(), state.labels), ...changes];
  const refusal = uncommittedReason(source);
  printReport({ source, rows, problems, warnings, changes: allChanges, refusal });
  if (options.isApply) await apply({ source, problems, changes: allChanges, state, refusal });
  else process.exitCode = problems.length ? 1 : 0;
}

function printReport({ source, rows, problems, warnings, changes, refusal }) {
  const open = rows.filter(row => row.status === 'open');
  const linked = rows.filter(row => row.issueNumber);
  console.log(`${source.repoPath} (${source.commit.slice(0, 7)}): ${rows.length} rows, ${open.length} open, ${linked.length} with an issue number`);
  for (const row of rows.filter(r => r.status === 'open' || r.issueNumber)) {
    const status = `${row.status}${row.issueNumber ? ` #${row.issueNumber}` : ''}`;
    console.log(`  ${status.padEnd(14)}${row.date}  ${shorten(row.whatFailed)}`);
  }
  for (const problem of problems) console.log(`  PROBLEM: ${problem}`);
  console.log(`  changes: ${changeCount(changes.length)}`);
  for (const change of changes) console.log(`    ${describeChange(change)}`);
  for (const warning of warnings) console.log(`  WARNING: ${warning}`);
  if (refusal) console.log(`  => --apply refuses it: ${refusal}`);
  console.log(changeCount(changes.length));
}

// Each number is written back the moment its issue exists, so a stop halfway loses no link.
async function apply({ source, problems, changes, state, refusal }) {
  if (refusal) throw new Error(`--apply refused: ${source.repoPath}: ${refusal}`);
  if (problems.length) throw new Error('--apply refused: PAPERCUTS.md has problems (see PROBLEM above)');
  refuseUnlessOwner(state);
  const filePath = path.join(REPO_ROOT, source.repoPath);
  console.log(`\napplying ${changeCount(changes.length)}, one write about every second`);
  try {
    await applyChanges(changes, {
      onPapercutNumber: (row, number) => {
        writeBackIssueNumber(filePath, row, number);
        console.log(`    wrote #${number} into the row from ${row.date}`);
      },
    });
  } finally {
    // Done or stopped halfway, the numbers written so far must be committed before the next
    // --apply, which refuses a changed file.
    console.log(`commit ${source.repoPath} now, then run again without --apply to see what is left`);
  }
}

function shorten(text) {
  return text.length <= LISTED_TEXT_LENGTH ? text : `${text.slice(0, LISTED_TEXT_LENGTH - 1)}…`;
}
