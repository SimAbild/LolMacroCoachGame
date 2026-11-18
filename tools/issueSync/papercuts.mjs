// Reads the table in PAPERCUTS.md and works out what GitHub should hold for it: an issue for every
// open row, closed when the row turns fixed or accepted. Pure: text and state in, plain data out.
// The rules are R6 in specs/github-issues/spec.md.
import { createHash } from 'node:crypto';
import { stateChanges } from './planChanges.mjs';

const ROW = /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/;
const UNESCAPED_PIPE = /(?<!\\)\|/;
const STATUS = /^(open|fixed|accepted)(?: #(\d+))?$/;
const MARKER = /<!-- lmc-papercut: (\S+) -->/;
const MAX_TITLE_LENGTH = 100;
const MIRROR_NOTE = '_This issue mirrors a row in PAPERCUTS.md. Change the row\'s status there (`fixed #<this issue>` or `accepted #<this issue>`), not this issue: the next sync reopens an issue closed by hand while its row is open._';

export function parsePapercuts(text) {
  const rows = [];
  const problems = [];
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    if (!ROW.test(line)) return;
    const row = readRow(line, lineIndex);
    if (row.problem) problems.push(`line ${lineIndex + 1}: ${row.problem}`);
    else rows.push(row);
  });
  return { rows, problems };
}

function readRow(line, lineIndex) {
  const cells = line.split(UNESCAPED_PIPE).slice(1, -1).map(cell => cell.trim());
  if (cells.length !== 4) return { problem: `${cells.length} cells, not 4 (date, what failed, workaround, status)` };
  const [date, whatFailed, workaround, statusCell] = cells;
  const status = statusCell.match(STATUS);
  if (!status) return { problem: `status "${statusCell}" is not open, fixed or accepted, with an optional #number` };
  return { lineIndex, date, whatFailed, workaround, status: status[1], issueNumber: status[2] ? Number(status[2]) : null };
}

// context: { repoUrl, commit }. Returns { changes, warnings }.
export function papercutChanges(rows, state, context) {
  const warnings = [];
  const owned = ownedPapercutIssues(state, warnings);
  const changes = rows.flatMap(row => rowChanges(row, desiredIssue(row, context), owned, state.owner, warnings));
  const referenced = new Set(rows.map(row => row.issueNumber).filter(Boolean));
  for (const issue of owned.byNumber.values()) {
    const isWaitingForWriteBack = changes.some(change => change.number === issue.number && change.kind === 'link-papercut');
    if (!referenced.has(issue.number) && !isWaitingForWriteBack) warnings.push(`#${issue.number} is a papercut issue that no row points at; left as it is`);
  }
  return { changes, warnings };
}

function rowChanges(row, wanted, owned, owner, warnings) {
  if (row.issueNumber) {
    const issue = owned.byNumber.get(row.issueNumber);
    if (issue) return stateChanges(wanted, issue);
    warnings.push(`the row from ${row.date} points at #${row.issueNumber}, which is not a papercut issue opened by ${owner}; left alone`);
    return [];
  }
  if (row.status !== 'open') return [];
  const issue = owned.byMarker.get(wanted.marker);
  if (!issue) return [{ kind: 'create-papercut', issue: wanted, row }];
  return [{ kind: 'link-papercut', number: issue.number, issue: wanted, row }, ...stateChanges(wanted, issue)];
}

// As with tasks, only issues the owner opened count, so a copied marker cannot take a row over.
function ownedPapercutIssues(state, warnings) {
  const byNumber = new Map();
  const byMarker = new Map();
  for (const issue of state.issues) {
    const marker = issue.body.match(MARKER);
    if (!marker) continue;
    if (issue.author !== state.owner) {
      warnings.push(`#${issue.number} carries a papercut marker but was opened by ${issue.author}; ignored`);
      continue;
    }
    byNumber.set(issue.number, issue);
    byMarker.set(marker[0], issue);
  }
  return { byNumber, byMarker };
}

function desiredIssue(row, { repoUrl, commit }) {
  const marker = `<!-- lmc-papercut: ${row.date}/${shortHash(row.whatFailed)} -->`;
  const at = `[PAPERCUTS.md at ${commit.slice(0, 7)}](${repoUrl}/blob/${commit}/PAPERCUTS.md)`;
  return {
    marker,
    title: shortTitle(unescape(row.whatFailed)),
    body: [
      `A row in [PAPERCUTS.md](${repoUrl}/blob/main/PAPERCUTS.md) from ${row.date}.`,
      `**What failed:** ${unescape(row.whatFailed)}`,
      `**Workaround:** ${unescape(row.workaround)}`,
      MIRROR_NOTE,
      marker,
    ].join('\n\n'),
    labels: ['papercut'],
    milestone: null,
    ...closingFor(row.status, at),
  };
}

function closingFor(status, at) {
  if (status === 'fixed') return { state: 'closed', stateReason: 'completed', closeComment: `Marked fixed in ${at}.` };
  if (status === 'accepted') return { state: 'closed', stateReason: 'not_planned', closeComment: `Marked accepted ("we live with it") in ${at}.` };
  return { state: 'open', stateReason: null, reopenComment: `Reopened: the row is open in ${at}.` };
}

// Cut at a word, so a 390-character cell still makes a title that reads as a sentence start.
function shortTitle(text) {
  if (text.length <= MAX_TITLE_LENGTH) return text;
  const cut = text.slice(0, MAX_TITLE_LENGTH - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.(]+$/, '')}…`;
}

function unescape(cell) {
  return cell.replace(/\\\|/g, '|');
}

function shortHash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 8);
}
