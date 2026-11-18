// Finds the plans and reads their text, from the working tree or, with a ref, from a branch
// through git, so a feature branch can be mirrored without checking it out.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PLAN_PATH = /^specs\/([^/]+)\/plan\.md$/;
const SKIPPED_FOLDERS = new Set(['_templates']);

// Repo-relative paths always use "/": git needs them that way, also on Windows.
export function listPlanPaths(ref) {
  const paths = ref ? listPathsAtRef(ref) : listPathsInWorkingTree();
  return paths.filter(planPath => PLAN_PATH.test(planPath)).sort();
}

export function featureOf(planPath) {
  return toRepoPath(planPath).split('/').at(-2);
}

export function isSkippedFolder(planPath) {
  return SKIPPED_FOLDERS.has(featureOf(planPath));
}

export function readPlanSource(planPath, ref) {
  const repoPath = toRepoPath(planPath);
  if (ref) return { repoPath, ref, commit: git(['rev-parse', ref]).trim(), text: git(['show', `${ref}:${repoPath}`]) };
  return { repoPath, ref: null, commit: git(['rev-parse', 'HEAD']).trim(), text: readFileSync(path.join(REPO_ROOT, repoPath), 'utf8') };
}

export function currentBranch() {
  return git(['branch', '--show-current']).trim();
}

// R5: --apply refuses a plan whose permalink would not show what was read.
export function uncommittedReason(source) {
  if (source.ref) return null;
  if (source.repoPath.startsWith('../')) return 'the file lies outside this repository';
  return git(['status', '--porcelain', '--', source.repoPath]).trim() ? 'the file has uncommitted changes' : null;
}

export function readLabelDefinitions() {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, '.github', 'labels.json'), 'utf8'));
}

function listPathsAtRef(ref) {
  return git(['ls-tree', '-r', '--name-only', ref, '--', 'specs']).split('\n').map(line => line.trim());
}

function listPathsInWorkingTree() {
  return readdirSync(path.join(REPO_ROOT, 'specs'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `specs/${entry.name}/plan.md`)
    .filter(planPath => existsSync(path.join(REPO_ROOT, planPath)));
}

// Accepts "specs\x\plan.md", "./specs/x/plan.md" or an absolute path inside the repository.
function toRepoPath(planPath) {
  const absolute = path.resolve(REPO_ROOT, planPath);
  return path.relative(REPO_ROOT, absolute).split(path.sep).join('/');
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // Rethrown with the git command and its own message, so the reader sees which read failed.
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr?.trim() || error.message}`);
  }
}
