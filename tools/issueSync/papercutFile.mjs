// Writes an issue number back into one row of PAPERCUTS.md ("open" becomes "open #25"), right
// after the issue is created. Every other byte of the file, line endings included, stays as it was.
import { readFileSync, writeFileSync } from 'node:fs';

const OPEN_STATUS_AT_END = /\|\s*open\s*\|(\s*)$/;

export function writeBackIssueNumber(filePath, row, number) {
  // Split with the line endings kept, so a CRLF file is written back as CRLF: lines sit at even
  // indexes, their endings at odd ones.
  const parts = readFileSync(filePath, 'utf8').split(/(\r?\n)/);
  const index = row.lineIndex * 2;
  const line = parts[index] ?? '';
  if (!line.includes(row.date) || !line.includes(row.whatFailed)) {
    throw new Error(`line ${row.lineIndex + 1} of ${filePath} is no longer the row from ${row.date}: write #${number} into its status by hand`);
  }
  if (!OPEN_STATUS_AT_END.test(line)) throw new Error(`the row from ${row.date} no longer ends in "| open |": write #${number} into its status by hand`);
  parts[index] = line.replace(OPEN_STATUS_AT_END, (match, trailing) => `| open #${number} |${trailing}`);
  writeFileSync(filePath, parts.join(''));
}
