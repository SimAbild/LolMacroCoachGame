// Turns the text of a specs/<feature>/plan.md into plain data. Pure: no files, no git, no GitHub,
// so every plan format that exists can be checked by a dry run before anything is published.
// The grammar is R3 and R4 in specs/github-issues/spec.md.

const TASK_HEADING = /^## Task (\d+[a-z]?)(?: \(([^)]*)\))?: (.+)$/;
const ANY_TASK_HEADING = /^## Task\b/;
const REVIEW_HEADING = /^## After the last task\s*$/;
const BOX = /\[([ xX])\]\s*(built|tests shown|reviewed|approved)/g;
const CHECKLIST_ITEM = /^- \[([ xX])\]\s*(.*)$/;
const SKIP_START = /^(?:- )?Skipped \(/;
const COVERS_START = /^- \*\*Covers:\*\*\s*/;
const REVIEW_LEVELS = ['low', 'medium', 'high'];

export const TASK_STATE = Object.freeze({ DONE: 'done', SKIPPED: 'skipped', OPEN: 'open' });

export function parsePlan(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const { preamble, sections } = splitSections(lines);
  const problems = [];
  const plan = {
    ...readPreamble(preamble),
    tasks: readTasks(sections, problems),
    review: readReview(sections),
    problems,
  };
  if (!plan.review) problems.push('no "## After the last task" section');
  return plan;
}

export function taskState(task) {
  if (task.skip) return TASK_STATE.SKIPPED;
  return task.boxes.built && task.boxes['tests shown'] ? TASK_STATE.DONE : TASK_STATE.OPEN;
}

// A plan is cut at every "## " heading; what comes before the first one is its preamble.
function splitSections(lines) {
  const preamble = [];
  const sections = [];
  for (const line of lines) {
    if (line.startsWith('## ')) sections.push({ heading: line.trimEnd(), lines: [] });
    else if (sections.length) sections.at(-1).lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

function readPreamble(lines) {
  const valueOf = prefix => lines.find(line => line.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
  const status = valueOf('Status:');
  const levelWord = valueOf('Review level:')?.match(/^[A-Za-z]+/)?.[0].toLowerCase() ?? null;
  return {
    title: valueOf('# Plan:'),
    status,
    isApproved: Boolean(status?.startsWith('approved')),
    milestone: valueOf('Milestone:') || null,
    reviewLevel: REVIEW_LEVELS.includes(levelWord) ? levelWord : null,
    reviewLevelText: levelWord,
  };
}

function readTasks(sections, problems) {
  const tasks = [];
  for (const section of sections.filter(s => ANY_TASK_HEADING.test(s.heading))) {
    const task = readTask(section, problems);
    if (!task) continue;
    if (tasks.some(other => other.id === task.id)) problems.push(`Task ${task.id} appears twice`);
    tasks.push(task);
  }
  return tasks;
}

function readTask(section, problems) {
  const match = section.heading.match(TASK_HEADING);
  if (!match) {
    problems.push(`heading does not follow "## Task <id>[ (<condition>)]: <title>": ${section.heading}`);
    return null;
  }
  const [, id, condition = null, title] = match;
  const items = listItems(section.lines);
  const boxItem = items.find(item => CHECKLIST_ITEM.test(item) && /\bbuilt\b/.test(item));
  const task = {
    id,
    condition,
    title: title.trim(),
    heading: section.heading,
    covers: items.find(item => COVERS_START.test(item))?.replace(COVERS_START, '') ?? null,
    boxes: readBoxes(boxItem),
    skip: items.find(item => SKIP_START.test(item))?.replace(/^- /, '') ?? null,
  };
  if (!boxItem && !task.skip) problems.push(`Task ${id} has neither a box line nor a "Skipped (" line`);
  return task;
}

function readBoxes(boxItem) {
  const boxes = { built: false, 'tests shown': false, reviewed: false, approved: false };
  for (const [, mark, name] of (boxItem ?? '').matchAll(BOX)) boxes[name] = mark !== ' ';
  return boxes;
}

function readReview(sections) {
  const section = sections.find(s => REVIEW_HEADING.test(s.heading));
  if (!section) return null;
  const items = listItems(section.lines)
    .map(item => item.match(CHECKLIST_ITEM))
    .filter(Boolean)
    .map(([, mark, text]) => ({ isTicked: mark !== ' ', text }));
  return { items };
}

// Joins each top-level list item (or loose paragraph) with its wrapped and nested lines, so an
// item that runs over several lines is read as one. It ends at a blank line or the next item.
function listItems(lines) {
  const items = [];
  let current = null;
  for (const line of lines) {
    if (!line.trim()) current = null;
    else if (startsNewItem(line, current)) items.push(current = { isListItem: line.startsWith('- '), parts: [line.trim()] });
    else current.parts.push(line.trim());
  }
  return items.map(item => item.parts.join(' '));
}

// A list item continues on indented lines; an unindented line after it (a "Skipped (" line, say)
// starts something new. A loose paragraph continues until a blank line or a list item.
function startsNewItem(line, current) {
  if (!current || line.startsWith('- ')) return true;
  return current.isListItem && !/^\s/.test(line);
}
