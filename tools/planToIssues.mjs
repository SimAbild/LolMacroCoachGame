// Mirrors each approved specs/<feature>/plan.md as a GitHub milestone with one issue per task.
// plan.md stays the truth; GitHub only shows it. Spec: specs/github-issues/spec.md.
// Run: node tools/planToIssues.mjs [plan.md ...] [--ref <branch>] [--github-state <file>] [--verbose]
//   Without paths it reads every plan under specs/. It only prints what it would change.
//   --ref reads the plans from that branch through git, without checking it out.
//   --github-state compares with a saved state instead of GitHub (for tests).
import { parsePlan, taskState } from './issueSync/parsePlan.mjs';
import { currentBranch, featureOf, isSkippedFolder, listPlanPaths, readLabelDefinitions, readPlanSource, uncommittedReason } from './issueSync/readPlan.mjs';
import { desiredState } from './issueSync/desiredState.mjs';
import { describeChange, labelChanges, planChanges } from './issueSync/planChanges.mjs';
import { ensureGhReady, loadSavedState, readGithubState } from './issueSync/githubState.mjs';

const BOX_NAMES = ['built', 'tests shown', 'reviewed', 'approved'];

try {
  const options = readOptions(process.argv.slice(2));
  const reports = planPathsFor(options).map(planPath => readReport(planPath, options));
  const state = reports.some(report => report.verdict?.willMirror) ? githubStateFor(options) : null;
  const labelChangeList = state ? labelChanges(readLabelDefinitions(), state.labels) : [];
  printLabelChanges(labelChangeList, state);
  for (const report of reports) compareAndPrint(report, state, options);
  printTotals(reports, labelChangeList);
  finish(reports, options);
} catch (error) {
  // A bad option, a failed git or gh call, or a marker on two issues: print why and stop.
  console.error(`planToIssues: ${error.message}`);
  process.exitCode = 1;
}

function readOptions(args) {
  const options = { paths: [], ref: null, githubStatePath: null, isVerbose: false, isApply: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--ref') options.ref = args[++index] ?? fail('--ref needs a branch name');
    else if (arg === '--github-state') options.githubStatePath = args[++index] ?? fail('--github-state needs a file');
    else if (arg === '--verbose') options.isVerbose = true;
    else if (arg === '--apply') options.isApply = true;
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
    else options.paths.push(arg);
  }
  if (options.isApply && options.githubStatePath) fail('--apply cannot be used with --github-state, which is for tests');
  return options;
}

function planPathsFor({ paths, ref }) {
  return paths.length ? paths : listPlanPaths(ref);
}

function githubStateFor({ githubStatePath }) {
  if (githubStatePath) return loadSavedState(githubStatePath);
  ensureGhReady();
  return readGithubState();
}

function readReport(planPath, options) {
  if (isSkippedFolder(planPath)) return { planPath, verdict: { willMirror: false, isSkipped: true, reason: 'skipped: a template, never mirrored' } };
  const source = readPlanSource(planPath, options.ref);
  const plan = parsePlan(source.text);
  return { planPath, source, plan, verdict: mirrorVerdict(plan), refusal: uncommittedReason(source) };
}

// R2: only an approved plan with a milestone and a review level is mirrored.
function mirrorVerdict(plan) {
  if (!plan.milestone) return { willMirror: false, reason: 'left out: no "Milestone:" line' };
  if (!plan.isApproved) return { willMirror: false, reason: 'left out: its status is not "approved"' };
  if (!plan.reviewLevel) return { willMirror: false, reason: `refused: "Review level:" is ${plan.reviewLevelText ?? 'missing'}, not Low, Medium or High` };
  if (plan.problems.length) return { willMirror: false, reason: 'refused: the plan has problems (above)' };
  return { willMirror: true, reason: '--apply would mirror it' };
}

function compareAndPrint(report, state, options) {
  if (report.verdict.isSkipped) {
    console.log(`${report.planPath}\n  ${report.verdict.reason}\n`);
    return;
  }
  printPlan(report, options.isVerbose);
  if (report.verdict.willMirror) {
    const desired = desiredState(report.plan, contextFor(report.source, state));
    Object.assign(report, planChanges(desired, state));
    printChanges(report);
  }
  console.log(`  => ${report.verdict.reason}${report.refusal ? `; --apply would refuse: ${report.refusal}` : ''}\n`);
}

function contextFor(source, state) {
  return {
    feature: featureOf(source.repoPath),
    repoPath: source.repoPath,
    branch: source.ref ?? currentBranch(),
    commit: source.commit,
    repoUrl: state.repoUrl,
  };
}

function printPlan({ plan, source }, isVerbose) {
  const where = source.ref ? ` @ ${source.ref}` : '';
  console.log(`${source.repoPath}${where} (${source.commit.slice(0, 7)})  feature: ${featureOf(source.repoPath)}`);
  console.log(`  milestone: ${plan.milestone ?? '-'} · review: ${plan.reviewLevel ?? '-'} · status: ${plan.isApproved ? 'approved' : 'not approved'}`);
  for (const task of plan.tasks) printTask(task, isVerbose);
  printReview(plan.review);
  for (const problem of plan.problems) console.log(`  PROBLEM: ${problem}`);
}

function printTask(task, isVerbose) {
  const boxes = BOX_NAMES.map(name => (task.boxes[name] ? 'x' : '-')).join('');
  const condition = task.condition ? `  (condition: ${task.condition})` : '';
  console.log(`  Task ${task.id.padEnd(4)}${taskState(task).padEnd(8)}[${boxes}] ${task.title}${condition}`);
  if (task.skip) console.log(`             ${task.skip}`);
  if (isVerbose) console.log(`             covers: ${task.covers ?? '-'}`);
}

function printReview(review) {
  if (!review) return;
  const ticked = review.items.filter(item => item.isTicked).length;
  const state = ticked === review.items.length ? 'done' : 'open';
  console.log(`  ${'Review'.padEnd(9)}${state.padEnd(8)}${ticked} of ${review.items.length} boxes ticked`);
}

function printLabelChanges(changes, state) {
  if (!state) return;
  console.log(`labels (.github/labels.json) against ${state.repoUrl}: ${countText(changes.length)}`);
  for (const change of changes) console.log(`    ${describeChange(change)}`);
  console.log('');
}

function printChanges({ changes, warnings }) {
  console.log(`  changes: ${countText(changes.length)}`);
  for (const change of changes) console.log(`    ${describeChange(change)}`);
  for (const warning of warnings) console.log(`  WARNING: ${warning}`);
}

function printTotals(reports, labelChangeList) {
  const count = test => reports.filter(test).length;
  const changes = labelChangeList.length + reports.reduce((sum, report) => sum + (report.changes?.length ?? 0), 0);
  console.log(`${reports.length} plan${reports.length === 1 ? '' : 's'}: ${count(r => r.verdict.willMirror)} mirrored, ${count(r => !r.verdict.willMirror && !r.verdict.isSkipped)} left out, ${count(r => r.verdict.isSkipped)} skipped, ${count(r => r.plan?.problems.length)} with problems`);
  console.log(countText(changes));
}

function finish(reports, options) {
  const hasProblems = reports.some(report => report.plan?.problems.length);
  const refusals = reports.filter(report => report.verdict.willMirror && report.refusal);
  if (options.isApply && refusals.length) fail(`--apply refused: ${refusals.map(r => `${r.source.repoPath}: ${r.refusal}`).join('; ')}`);
  if (options.isApply) fail('--apply is not built yet (specs/github-issues, Task 3)');
  process.exitCode = hasProblems ? 1 : 0;
}

function countText(count) {
  return `${count} change${count === 1 ? '' : 's'}`;
}

function fail(message) {
  throw new Error(message);
}
