/**
 * Graded quizzes for Business Analytics I.
 *
 * Receives the quiz at the end of each lab
 * (https://hizocar.github.io/mba-business-analytics-1/sessions/), scores it
 * against the private "Keys" sheet, and records it in "Responses". The answers
 * never reach the browser or this repository.
 *
 * Spreadsheet tabs:
 *   Keys       quiz | question | answer          (answer = 0-based option index)
 *   Responses  Received | Quiz | Name | Email | Answers | Score | Out of | Attempt | Counts
 *
 * Setup (once): open the spreadsheet › Extensions › Apps Script, paste this file,
 * then Deploy › New deployment › Web app, Execute as "Me", Who has access "Anyone".
 * Copy the /exec URL into ENDPOINT in docs/javascripts/explainers/graded-quiz.js.
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    const quiz = String(d.quiz || "");
    const key = keyFor(quiz);
    if (!key.length) throw new Error("Unknown quiz.");

    const name = clean(d.name, 80);
    const email = clean(d.email, 120).toLowerCase();
    if (!name) throw new Error("Missing name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Check your email.");
    const answers = (d.answers || []).map(Number);
    if (answers.length !== key.length) throw new Error("Answer every question.");

    const results = key.map((right, i) => answers[i] === right);
    const score = results.filter(Boolean).length;

    const sheet = tab("Responses");
    const earlier = sheet.getDataRange().getValues().slice(1).filter((r) => r[1] === quiz && r[3] === email);
    const attempt = earlier.length + 1;
    addRow(sheet, [new Date(), quiz, name, email, answers.join(","), score, key.length, attempt, attempt === 1 ? "Yes" : "No"]);

    const first = earlier.length ? earlier[0] : null;
    const message = first
      ? `You got ${score} of ${key.length} this time. This was attempt ${attempt}; your first attempt (${first[5]} of ${first[6]}) is the one that counts.`
      : `Recorded: ${score} of ${key.length}. This is the score that counts for this quiz.`;
    return json({ ok: true, score, total: key.length, results, attempt, message });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: "Business Analytics I quizzes" });
}

// The correct option of each question of a quiz, in question order.
function keyFor(quiz) {
  return tab("Keys")
    .getDataRange()
    .getValues()
    .slice(1)
    .filter((r) => r[0] === quiz)
    .sort((a, b) => a[1] - b[1])
    .map((r) => Number(r[2]));
}

function tab(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Writes after the last value in column A, so formula columns added to the
// right of the data never push new rows to the bottom of the sheet.
function addRow(sheet, values) {
  const colA = sheet.getRange(1, 1, sheet.getMaxRows(), 1).getValues();
  let last = colA.length;
  while (last > 1 && colA[last - 1][0] === "") last--;
  if (last + 1 > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  sheet.getRange(last + 1, 1, 1, values.length).setValues([values]);
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/^[=+\-@]+/, "").trim().slice(0, max); // no spreadsheet formulas
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
