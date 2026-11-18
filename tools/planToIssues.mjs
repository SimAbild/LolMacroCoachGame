// Mirrors each approved specs/<feature>/plan.md as a GitHub milestone with one issue per task.
// plan.md stays the truth; GitHub only shows it. Spec: specs/github-issues/spec.md.
// Run: node tools/planToIssues.mjs [--apply] [plan.md ...] [--ref <branch>] [--github-state <file>] [--verbose]
//      node tools/planToIssues.mjs [--apply] --papercuts [PAPERCUTS.md] [--github-state <file>]
//   Without paths it reads every plan under specs/. Without --apply it only prints what it would change.
//   --apply carries the changes out on GitHub. Put it first: the ask rule in .claude/settings.json
//   matches "node tools/planToIssues.mjs --apply".
//   --ref reads the plans from that branch through git, without checking it out.
//   --papercuts mirrors the open rows of PAPERCUTS.md instead of the plans.
//   --github-state compares with a saved state instead of GitHub (for tests).
import { parsePlan, taskState } from './issueSync/parsePlan.mjs';
import { currentBranch, featureOf, isSkippedFolder, listPlanPaths, readLabelDefinitions, readPlanSource, uncommittedReason } from './issueSync/readPlan.mjs';
import { desiredState } from './issueSync/desiredState.mjs';
import { changeCount, describeChange, labelChanges, planChanges } from './issueSync/planChanges.mjs';
import { loadGithubState, refuseUnlessOwner } from './issueSync/githubState.mjs';
import { applyChanges } from './issueSync/applyChanges.mjs';
import { runPapercuts } from './issueSync/runPapercuts.mjs';

const BOX_NAMES = ['built', 'tests shown', 'reviewed', 'approved'];
const FEATURE_NAME = /^[a-z0-9-]+$/;

try {
  const options = readOptions(process.argv.slice(2));
  await (options.isPapercuts ? runPapercuts(options) : runPlans(options));
} catch (error) {
  // A bad option, a failed git or gh call, or a marker on two issues: print why and stop.
  console.error(`planToIssues: ${error.message}`);
  process.exitCode = 1;
}

async function runPlans(options) {
  const reports = planPathsFor(options).map(planPath => readReport(planPath, options));
  const state = reports.some(report => report.verdict?.willMirror) ? loadGithubState(options) : null;
  const labelChangeList = state ? labelChanges(readLabelDefinitions(), state.labels) : [];
  printLabelChanges(labelChangeList, state);
  for (const report of reports) compareAndPrint(report, state, options);
  printTotals(reports, labelChangeList);
  await finish({ reports, labelChangeList, state, options });
}

function readOptions(args) {
  const options = { paths: [], ref: null, githubStatePath: null, isVerbose: false, isApply: false, isPapercuts: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--ref') options.ref = args[++index] ?? fail('--ref needs a branch name');
    else if (arg === '--github-state') options.githubStatePath = args[++index] ?? fail('--github-state needs a file');
    else if (arg === '--verbose') options.isVerbose = true;
    else if (arg === '--papercuts') options.isPapercuts = true;
    else if (arg === '--apply') options.isApply = index === 0 || fail('put --apply first, so the ask rule in .claude/settings.json sees it');
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
    else options.paths.push(arg);
  }
  if (options.isApply && options.githubStatePath) fail('--apply cannot be used with --github-state, which is for tests');
  return options;
}

function planPathsFor({ paths, ref }) {
  return paths.length ? paths : listPlanPaths(ref);
}

function readReport(planPath, options) {
  if (isSkippedFolder(planPath)) {
    return { planPath, verdict: { willMirror: false, isSkipped: true, reason: 'skipped: a template, never mirrored' } };
  }
  const source = readPlanSource(planPath, options.ref);
  const plan = parsePlan(source.text);
  const verdict = mirrorVerdict(plan, featureOf(source.repoPath));
  return { planPath, source, plan, verdict, refusal: uncommittedReason(source) };
}

// R2: only an approved plan with a milestone and a review level is mirrored. The folder name goes
// into every marker, so it must stay one plain word the marker pattern can read back.
function mirrorVerdict(plan, feature) {
  if (!plan.milestone) return { willMirror: false, reason: 'left out: no "Milestone:" line' };
  if (!plan.isApproved) return { willMirror: false, reason: 'left out: its status is not "approved"' };
  if (!plan.reviewLevel) {
    return { willMirror: false, reason: `refused: "Review level:" is ${plan.reviewLevelText ?? 'missing'}, not Low, Medium or High` };
  }
  if (!FEATURE_NAME.test(feature)) return { willMirror: false, reason: `refused: the folder name "${feature}" is not lower-case letters, digits and hyphens` };
  if (plan.problems.length) return { willMirror: false, reason: 'refused: the plan has problems (above)' };
  return { willMirror: true, reason: 'mirrored' };
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
  console.log(`  => ${verdictText(report, options)}\n`);
}

function verdictText({ verdict, refusal, changes }, { isApply }) {
  if (!verdict.willMirror) return verdict.reason;
  if (refusal) return `--apply refuses it: ${refusal}`;
  if (!changes.length) return 'GitHub already matches the plan';
  return isApply ? 'the changes above are applied below' : '--apply would make the changes above';
}

function contextFor(source, state) {
  return {
    feature: featureOf(source.repoPath),
    repoPath: source.repoPath,
    branch: linkBranch(source.ref),
    commit: source.commit,
    repoUrl: state.repoUrl,
  };
}

// The branch the issue links point at, as GitHub names it ("origin/x" is "x" there).
function linkBranch(ref) {
  if (ref) return ref.replace(/^origin\//, '');
  return currentBranch() || fail('HEAD is detached, so the links would have no branch: check out a branch or use --ref');
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
  const state = review.items.length && ticked === review.items.length ? 'done' : 'open';
  console.log(`  ${'Review'.padEnd(9)}${state.padEnd(8)}${ticked} of ${review.items.length} boxes ticked`);
}

function printLabelChanges(changes, state) {
  if (!state) return;
  console.log(`labels (.github/labels.json) against ${state.repoUrl}: ${changeCount(changes.length)}`);
  for (const change of changes) console.log(`    ${describeChange(change)}`);
  console.log('');
}

function printChanges({ changes, warnings }) {
  console.log(`  changes: ${changeCount(changes.length)}`);
  for (const change of changes) console.log(`    ${describeChange(change)}`);
  for (const warning of warnings) console.log(`  WARNING: ${warning}`);
}

function printTotals(reports, labelChangeList) {
  const count = test => reports.filter(test).length;
  const changes = labelChangeList.length + reports.reduce((sum, report) => sum + (report.changes?.length ?? 0), 0);
  const plans = `${reports.length} plan${reports.length === 1 ? '' : 's'}`;
  const leftOut = count(r => !r.verdict.willMirror && !r.verdict.isSkipped);
  console.log(`${plans}: ${count(r => r.verdict.willMirror)} mirrored, ${leftOut} left out, ${count(r => r.verdict.isSkipped)} skipped, ${count(r => r.plan?.problems.length)} with problems`);
  console.log(changeCount(changes));
}

async function finish({ reports, labelChangeList, state, options }) {
  const hasProblems = reports.some(report => report.plan?.problems.length);
  if (!options.isApply) {
    process.exitCode = hasProblems ? 1 : 0;
    return;
  }
  refuseUnsafeApply(reports, hasProblems, state);
  const changes = [...labelChangeList, ...reports.flatMap(report => report.changes ?? [])];
  console.log(`\napplying ${changeCount(changes.length)}, one write about every second`);
  await applyChanges(changes);
  console.log('applied: run again without --apply to see that nothing is left');
}

// Nothing is written unless every plan reads cleanly, every mirrored plan is committed, and gh
// writes as the owner.
function refuseUnsafeApply(reports, hasProblems, state) {
  const refusals = reports.filter(report => report.verdict.willMirror && report.refusal);
  if (refusals.length) fail(`--apply refused: ${refusals.map(r => `${r.source.repoPath}: ${r.refusal}`).join('; ')}`);
  if (hasProblems) fail('--apply refused: a plan has problems (see PROBLEM above)');
  if (state) refuseUnlessOwner(state);
}

function fail(message) {
  throw new Error(message);
}
