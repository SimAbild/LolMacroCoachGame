// What GitHub should hold for one parsed plan: its milestone and one issue per task, plus the
// review issue. Pure: the links and the commit come in through the context.
import { TASK_STATE, taskState } from './parsePlan.mjs';

const MAX_TITLE_LENGTH = 256;
const REVIEW_ID = 'review';
const MIRROR_NOTE = '_This issue mirrors the plan. Change the plan, not this issue: the next sync overwrites edits made here._';

export const SYNC_LABELS = Object.freeze(['task', 'review:low', 'review:medium', 'review:high']);

export function markerFor(feature, id) {
  return `<!-- lmc-task: ${feature}/${id} -->`;
}

// context: { feature, repoPath, branch, commit, repoUrl }
export function desiredState(plan, context) {
  const isReviewDone = isEveryItemTicked(plan.review);
  return {
    feature: context.feature,
    milestone: {
      title: plan.milestone,
      description: `Feature folder: ${treeLink(context)}`,
      state: isReviewDone ? 'closed' : 'open',
    },
    issues: [
      ...plan.tasks.map(task => taskIssue(task, plan, context)),
      reviewIssue(plan, context, isReviewDone),
    ],
  };
}

// GitHub's heading anchors: lower case, punctuation dropped, spaces turned into hyphens.
export function headingAnchor(heading) {
  return heading.replace(/^#+\s*/, '').trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

function taskIssue(task, plan, context) {
  const anchor = headingAnchor(task.heading);
  const state = taskState(task);
  const lines = [
    `Task ${task.id} of \`${context.feature}\`: [${context.repoPath}](${branchLink(context, anchor)})`,
    task.condition && `**Condition:** ${task.condition}`,
    task.covers && `**Covers:** ${task.covers}`,
  ];
  return {
    marker: markerFor(context.feature, task.id),
    title: shortTitle(`${context.feature} · Task ${task.id}: ${task.title}`),
    body: bodyOf(lines, markerFor(context.feature, task.id)),
    labels: issueLabels(plan),
    milestone: plan.milestone,
    ...closingFor(state, task, permalink(context, anchor)),
  };
}

function reviewIssue(plan, context, isReviewDone) {
  const specPath = context.repoPath.replace(/plan\.md$/, 'spec.md');
  const checklist = plan.review.items.map(item => `- [${item.isTicked ? 'x' : ' '}] ${item.text}`);
  const lines = [
    `Review and approval of \`${context.feature}\`: [spec](${branchLink({ ...context, repoPath: specPath })}) · [plan](${branchLink(context, 'after-the-last-task')})`,
    checklist.join('\n'),
  ];
  const marker = markerFor(context.feature, REVIEW_ID);
  const link = permalink(context, 'after-the-last-task');
  return {
    marker,
    title: shortTitle(`${context.feature} · Review and approval`),
    body: bodyOf(lines, marker),
    labels: issueLabels(plan),
    milestone: plan.milestone,
    ...(isReviewDone
      ? { state: 'closed', stateReason: 'completed', closeComment: `Every box under "After the last task" is ticked in [plan.md at ${short(context.commit)}](${link}).` }
      : openState(link, context.commit)),
  };
}

// R4: done and skipped tasks are closed, each with the reason the plan gives; the rest are open.
function closingFor(state, task, link) {
  const at = `[plan.md at ${short(link.commit)}](${link.url})`;
  if (state === TASK_STATE.DONE) return { state: 'closed', stateReason: 'completed', closeComment: `Done: "built" and "tests shown" are ticked in ${at}, where the result and its proof are recorded.` };
  if (state === TASK_STATE.SKIPPED) return { state: 'closed', stateReason: 'not_planned', closeComment: `> ${task.skip}\n\nSkipped in ${at}.` };
  return openState(link.url, link.commit);
}

function openState(url, commit) {
  return { state: 'open', stateReason: null, reopenComment: `Reopened: the task is no longer done or skipped in [plan.md at ${short(commit)}](${url}).` };
}

function issueLabels(plan) {
  return ['task', `review:${plan.reviewLevel}`];
}

function bodyOf(lines, marker) {
  return [...lines.filter(Boolean), MIRROR_NOTE, marker].join('\n\n');
}

function isEveryItemTicked(review) {
  return review.items.length > 0 && review.items.every(item => item.isTicked);
}

function shortTitle(title) {
  return title.length <= MAX_TITLE_LENGTH ? title : `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

function branchLink({ repoUrl, branch, repoPath }, anchor) {
  return `${repoUrl}/blob/${branch}/${repoPath}${anchor ? `#${anchor}` : ''}`;
}

function permalink({ repoUrl, commit, repoPath }, anchor) {
  return { commit, url: `${repoUrl}/blob/${commit}/${repoPath}#${anchor}` };
}

function treeLink({ repoUrl, branch, feature }) {
  return `${repoUrl}/tree/${branch}/specs/${feature}`;
}

function short(commit) {
  return commit.slice(0, 7);
}
