// Compares what a plan wants on GitHub with what GitHub holds, and lists the changes that would
// make them match. Pure: it reads two plain objects and writes nothing.
import { SYNC_LABELS } from './desiredState.mjs';

const MARKER = /<!-- lmc-task: ([^\s]+) -->/;

export function labelChanges(definitions, labels) {
  const changes = [];
  for (const wanted of definitions) {
    const actual = labels.find(label => label.name === wanted.name);
    if (!actual) changes.push({ kind: 'create-label', label: wanted });
    else if (actual.color !== wanted.color || actual.description !== wanted.description) changes.push({ kind: 'update-label', label: wanted });
  }
  return changes;
}

// Returns { changes, warnings }; throws when a marker is on two issues, because then the sync
// cannot know which issue is the task's.
export function planChanges(desired, state) {
  const warnings = [];
  const owned = ownedTaskIssues(desired.feature, state, warnings);
  const changes = [
    ...milestoneChanges(desired.milestone, state.milestones),
    ...desired.issues.flatMap(issue => issueChanges(issue, owned.get(issue.marker))),
  ];
  for (const [marker, issue] of owned) {
    if (!desired.issues.some(wanted => wanted.marker === marker)) warnings.push(`#${issue.number} carries ${marker}, but the plan has no such task; left as it is`);
  }
  return { changes, warnings };
}

// Only issues opened by the repository's owner count, so a stranger who copies a marker into a
// public issue cannot take over a task.
function ownedTaskIssues(feature, state, warnings) {
  const owned = new Map();
  for (const issue of state.issues) {
    const marker = issue.body.match(MARKER);
    if (!marker || !marker[1].startsWith(`${feature}/`)) continue;
    if (issue.author !== state.owner) {
      warnings.push(`#${issue.number} carries ${marker[0]} but was opened by ${issue.author}, not ${state.owner}; ignored`);
      continue;
    }
    if (owned.has(marker[0])) throw new Error(`${marker[0]} is on #${owned.get(marker[0]).number} and #${issue.number}: close or edit one by hand, then sync again`);
    owned.set(marker[0], issue);
  }
  return owned;
}

function milestoneChanges(wanted, milestones) {
  const actual = milestones.find(milestone => milestone.title === wanted.title);
  if (!actual) return [{ kind: 'create-milestone', milestone: wanted }];
  const fields = ['description', 'state'].filter(field => actual[field] !== wanted[field]);
  return fields.length ? [{ kind: 'update-milestone', number: actual.number, milestone: wanted, fields }] : [];
}

function issueChanges(wanted, actual) {
  if (!actual) return [{ kind: 'create-issue', issue: wanted }];
  const changes = [];
  const update = contentUpdate(wanted, actual);
  if (update) changes.push(update);
  changes.push(...stateChanges(wanted, actual));
  return changes;
}

// Title, body, labels and milestone. Labels the sync does not own (needs-simon, say) are left on.
function contentUpdate(wanted, actual) {
  const addLabels = wanted.labels.filter(label => !actual.labels.includes(label));
  const removeLabels = actual.labels.filter(label => SYNC_LABELS.includes(label) && !wanted.labels.includes(label));
  const fields = [
    wanted.title !== actual.title && 'title',
    normalizeBody(wanted.body) !== normalizeBody(actual.body) && 'body',
    (addLabels.length || removeLabels.length) && 'labels',
    wanted.milestone !== actual.milestone && 'milestone',
  ].filter(Boolean);
  return fields.length ? { kind: 'update-issue', number: actual.number, issue: wanted, fields, addLabels, removeLabels } : null;
}

// A closed issue with the wrong reason is reopened and closed again, the only way gh changes it.
function stateChanges(wanted, actual) {
  if (wanted.state === 'open') return actual.state === 'open' ? [] : [{ kind: 'reopen-issue', number: actual.number, issue: wanted }];
  if (actual.state === 'open') return [{ kind: 'close-issue', number: actual.number, issue: wanted }];
  if (actual.stateReason === wanted.stateReason) return [];
  return [{ kind: 'reopen-issue', number: actual.number, issue: wanted }, { kind: 'close-issue', number: actual.number, issue: wanted }];
}

// GitHub may hand a body back with \r\n or trailing spaces; neither is a real difference.
function normalizeBody(body) {
  return body.replace(/\r\n/g, '\n').trim();
}

export function describeChange(change) {
  const target = change.number ? `#${change.number} ` : '';
  switch (change.kind) {
    case 'create-label': return `create label    ${change.label.name} (${change.label.color})`;
    case 'update-label': return `update label    ${change.label.name} (${change.label.color}, "${change.label.description}")`;
    case 'create-milestone': return `create milestone "${change.milestone.title}" (${change.milestone.state})`;
    case 'update-milestone': return `update milestone ${target}"${change.milestone.title}": ${change.fields.join(', ')}`;
    case 'create-issue': return `create issue    ${change.issue.title}  [${change.issue.labels.join(', ')}]${closedNote(change.issue)}`;
    case 'update-issue': return `update issue    ${target}${change.issue.title}: ${change.fields.join(', ')}`;
    case 'close-issue': return `close issue     ${target}${change.issue.title} (${change.issue.stateReason.replace('_', ' ')}, with a comment)`;
    case 'reopen-issue': return `reopen issue    ${target}${change.issue.title} (with a comment)`;
    default: throw new Error(`unknown change kind ${change.kind}`);
  }
}

function closedNote(issue) {
  return issue.state === 'closed' ? `, then close (${issue.stateReason.replace('_', ' ')})` : '';
}
