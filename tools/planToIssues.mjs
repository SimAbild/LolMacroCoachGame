// Mirrors each approved specs/<feature>/plan.md as a GitHub milestone with one issue per task.
// plan.md stays the truth; GitHub only shows it. Spec: specs/github-issues/spec.md.
// Run: node tools/planToIssues.mjs [plan.md ...] [--ref <branch>] [--verbose]
//   Without paths it reads every plan under specs/. It only prints (a dry run).
//   --ref reads the plans from that branch through git, without checking it out.
import { parsePlan, taskState } from './issueSync/parsePlan.mjs';
import { featureOf, isSkippedFolder, listPlanPaths, readPlanSource } from './issueSync/readPlan.mjs';

const BOX_NAMES = ['built', 'tests shown', 'reviewed', 'approved'];

try {
  const options = readOptions(process.argv.slice(2));
  const reports = planPathsFor(options).map(planPath => reportPlan(planPath, options));
  printTotals(reports);
  process.exitCode = reports.some(report => report.plan?.problems.length) ? 1 : 0;
} catch (error) {
  // A bad option or a failed git read: print why and stop, without a stack trace.
  console.error(`planToIssues: ${error.message}`);
  process.exitCode = 1;
}

function readOptions(args) {
  const options = { paths: [], ref: null, isVerbose: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--ref') options.ref = args[++index] ?? fail('--ref needs a branch name');
    else if (arg === '--verbose') options.isVerbose = true;
    else if (arg === '--apply') fail('--apply is not built yet (specs/github-issues, Task 3)');
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
    else options.paths.push(arg);
  }
  return options;
}

function planPathsFor({ paths, ref }) {
  return paths.length ? paths : listPlanPaths(ref);
}

function reportPlan(planPath, options) {
  if (isSkippedFolder(planPath)) {
    console.log(`${planPath}\n  skipped: a template, never mirrored\n`);
    return { planPath, verdict: 'skipped' };
  }
  const source = readPlanSource(planPath, options.ref);
  const plan = parsePlan(source.text);
  const verdict = mirrorVerdict(plan);
  printPlan({ plan, source, verdict, isVerbose: options.isVerbose });
  return { planPath, plan, verdict: verdict.willMirror ? 'mirror' : 'left out' };
}

// R2: only an approved plan with a milestone and a review level is mirrored.
function mirrorVerdict(plan) {
  if (!plan.milestone) return { willMirror: false, reason: 'left out: no "Milestone:" line' };
  if (!plan.isApproved) return { willMirror: false, reason: 'left out: its status is not "approved"' };
  if (!plan.reviewLevel) return { willMirror: false, reason: `refused: "Review level:" is ${plan.reviewLevelText ?? 'missing'}, not Low, Medium or High` };
  if (plan.problems.length) return { willMirror: false, reason: 'refused: the plan has problems (above)' };
  return { willMirror: true, reason: `--apply would mirror it: ${plan.tasks.length + 1} issues (tasks and the review)` };
}

function printPlan({ plan, source, verdict, isVerbose }) {
  const where = source.ref ? ` @ ${source.ref}` : '';
  console.log(`${source.repoPath}${where} (${source.commit.slice(0, 7)})  feature: ${featureOf(source.repoPath)}`);
  console.log(`  milestone: ${plan.milestone ?? '-'} · review: ${plan.reviewLevel ?? '-'} · status: ${plan.isApproved ? 'approved' : 'not approved'}`);
  for (const task of plan.tasks) printTask(task, isVerbose);
  printReview(plan.review);
  for (const problem of plan.problems) console.log(`  PROBLEM: ${problem}`);
  console.log(`  => ${verdict.reason}\n`);
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

function printTotals(reports) {
  const count = verdict => reports.filter(report => report.verdict === verdict).length;
  const withProblems = reports.filter(report => report.plan?.problems.length).length;
  console.log(`${reports.length} plans: ${count('mirror')} would be mirrored, ${count('left out')} left out, ${count('skipped')} skipped, ${withProblems} with problems`);
}

function fail(message) {
  throw new Error(message);
}
