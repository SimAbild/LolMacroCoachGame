// Reads what GitHub holds today (labels, milestones, issues, open and closed) through the gh CLI,
// or from a saved state file for tests. Only reads; writing comes with --apply.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { REPO_ROOT } from './readPlan.mjs';

const LIST_LIMIT = '1000';
const ISSUE_FIELDS = 'number,title,state,stateReason,body,labels,milestone,author';

export function ensureGhReady() {
  try {
    gh(['auth', 'status']);
  } catch (error) {
    // A missing gh keeps its own message; otherwise gh has no usable login, or no network.
    if (error.isMissingGh) throw error;
    throw new Error(`gh is not logged in to GitHub, or cannot reach it: run "gh auth login" first (${error.message})`);
  }
}

export function loadGithubState({ githubStatePath }) {
  if (githubStatePath) return loadSavedState(githubStatePath);
  ensureGhReady();
  return readGithubState();
}

// Issues opened by anyone but the owner are never matched, so writing as another gh account would
// create every issue again.
export function refuseUnlessOwner(state) {
  const login = gh(['api', 'user', '--jq', '.login']).trim();
  if (login !== state.owner) throw new Error(`--apply refused: gh is logged in as ${login}, not the owner ${state.owner} ("gh auth switch")`);
}

export function readGithubState() {
  const repo = JSON.parse(gh(['repo', 'view', '--json', 'owner,url']));
  return {
    owner: repo.owner.login,
    repoUrl: repo.url,
    labels: JSON.parse(gh(['label', 'list', '--limit', LIST_LIMIT, '--json', 'name,color,description'])).map(normalizeLabel),
    milestones: readMilestones().map(normalizeMilestone),
    issues: JSON.parse(gh(['issue', 'list', '--state', 'all', '--limit', LIST_LIMIT, '--json', ISSUE_FIELDS])).map(normalizeIssue),
  };
}

export function loadSavedState(filePath) {
  const state = JSON.parse(readFileSync(filePath, 'utf8'));
  const isState = state.owner && state.repoUrl && ['labels', 'milestones', 'issues'].every(key => Array.isArray(state[key]));
  if (!isState) throw new Error(`${filePath} is not a saved GitHub state (owner, repoUrl, labels, milestones, issues)`);
  return state;
}

// gh's own default returns only open milestones; state=all and --slurp get every page of all.
function readMilestones() {
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/milestones?state=all&per_page=100']));
  return pages.flat();
}

function normalizeLabel({ name, color, description }) {
  return { name, color: color.replace(/^#/, '').toLowerCase(), description: description ?? '' };
}

function normalizeMilestone({ number, title, state, description }) {
  return { number, title, state: state.toLowerCase(), description: description ?? '' };
}

function normalizeIssue(issue) {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state.toLowerCase(),
    stateReason: issue.stateReason ? issue.stateReason.toLowerCase() : null,
    body: issue.body ?? '',
    labels: issue.labels.map(label => label.name),
    milestone: issue.milestone?.title ?? null,
    author: issue.author?.login ?? null,
  };
}

export function gh(args, input) {
  try {
    return execFileSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8', input, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw ghError(args, error);
  }
}

// Turns a failed gh call into one readable line; a missing gh gets its own hint.
function ghError(args, error) {
  if (error.code === 'ENOENT') {
    return Object.assign(new Error('the GitHub CLI "gh" was not found on PATH: install it from https://cli.github.com and run "gh auth login"'), { isMissingGh: true });
  }
  return new Error(`gh ${args.join(' ')} failed: ${error.stderr?.trim() || error.message}`);
}
