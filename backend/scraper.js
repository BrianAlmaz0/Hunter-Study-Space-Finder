// scraper.js
// Scrapes ALL Hunter College subjects for Spring 2026 (In Person sections only).
// Saves results to backend/data/hunter-all-subjects-schedule.json
// Saves summary to backend/data/scrape-summary.json
//
// Run:  npm run scrape   (from the backend/ folder)

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, 'data');
const OUTPUT     = path.join(DATA_DIR, 'hunter-all-subjects-schedule.json');
const SUMMARY    = path.join(DATA_DIR, 'scrape-summary.json');
const START_URL  = 'https://globalsearch.cuny.edu/CFGlobalSearchTool/search.jsp';
const DELAY_MS   = 1500;

// ── Entry point ──────────────────────────────────────────────────────────────

async function scrape() {
  mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page    = await browser.newPage();
  page.setDefaultTimeout(30_000);

  const allClasses = [];
  const failedSubjects = [];
  let totalSubjectsAttempted = 0;
  let totalSubjectsSuccessful = 0;

  try {
    // ── PAGE 1 — Institution + Term ──────────────────────────────────────────
    console.log('\n[STEP 1] Loading CUNY Global Search...');
    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    console.log('[STEP 2] Selecting Hunter College...');
    await selectHunterCollege(page);
    await page.waitForLoadState('networkidle');

    console.log('[STEP 3] Selecting Spring 2026 term...');
    await selectTerm(page);

    console.log('[STEP 4] Clicking Next...');
    await clickSubmitButton(page, /Next/i);
    await page.waitForLoadState('networkidle');
    console.log('  Criteria page URL:', page.url());

    // ── PAGE 2 — Read all subjects, capture the select's name attribute ──────
    console.log('[STEP 5] Reading subject options...');
    const { options: subjects, selectName: subjectSelectName } = await getSubjectOptions(page);
    console.log(`  Found ${subjects.length} subjects (select name="${subjectSelectName}")`);

    // ── Set In Person once before the loop ───────────────────────────────────
    console.log('[STEP 6] Setting Instruction Mode to In Person...');
    await selectInstructionMode(page);

    // ── Loop through subjects ────────────────────────────────────────────────
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      totalSubjectsAttempted++;

      console.log(`\n[Subject ${i + 1}/${subjects.length}] ${subject.label} (${subject.value})`);

      try {
        // Target the subject select by its known name attribute — not by scanning
        const subjectSel = page.locator(`select[name="${subjectSelectName}"]`);
        if (await subjectSel.count() === 0) {
          throw new Error(`Subject select (name="${subjectSelectName}") not found on page`);
        }
        await subjectSel.selectOption({ value: subject.value });

        // Ensure In Person is still checked (idempotent)
        await selectInstructionMode(page);

        // Search
        await clickSubmitButton(page, /Search/i);
        await page.waitForLoadState('networkidle', { timeout: 60_000 });

        // Parse
        const html    = await page.content();
        const classes = parseSchedule(html, subject);
        console.log(`  ✓ ${classes.length} sections found`);

        allClasses.push(...classes);
        totalSubjectsSuccessful++;

        // Intermediate save after each subject (crash protection)
        writeFileSync(OUTPUT, JSON.stringify(allClasses, null, 2), 'utf8');

        // Return to criteria page for next subject
        if (i < subjects.length - 1) {
          await returnToCriteria(page, subjectSelectName);
          await delay(DELAY_MS);
        }

      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        failedSubjects.push({ value: subject.value, label: subject.label, error: err.message });

        try {
          await returnToCriteria(page, subjectSelectName);
          await delay(DELAY_MS);
        } catch (recoverErr) {
          console.error('  ✗ Recovery failed — aborting remaining subjects');
          break;
        }
      }
    }

  } catch (err) {
    console.error('\n✗ Scraper failed fatally:', err.message);
    try { await shot(page, 'error'); } catch { /* browser closed */ }
    throw err;
  } finally {
    writeFileSync(OUTPUT, JSON.stringify(allClasses, null, 2), 'utf8');

    const summary = {
      totalSubjectsAttempted,
      totalSubjectsSuccessful,
      totalClassesParsed: allClasses.length,
      failedSubjects,
    };
    writeFileSync(SUMMARY, JSON.stringify(summary, null, 2), 'utf8');

    console.log('\n══════════════════════════════════════');
    console.log(`✓ Subjects attempted:  ${totalSubjectsAttempted}`);
    console.log(`✓ Subjects successful: ${totalSubjectsSuccessful}`);
    console.log(`✓ Total sections:      ${allClasses.length}`);
    console.log(`✗ Failed subjects:     ${failedSubjects.length}`);
    console.log(`  Saved → ${OUTPUT}`);
    console.log(`  Saved → ${SUMMARY}`);
    console.log('══════════════════════════════════════\n');

    try { await browser.close(); } catch { /* already closed */ }
  }
}

// ── Navigation helpers ────────────────────────────────────────────────────────

// Returns to the criteria page. Verifies we're actually there by checking
// for the subject select. Strategies: already there → goBack → full restart.
// "Modify Search" is intentionally skipped — on CUNY it navigates to page 1,
// not back to the criteria form.
async function returnToCriteria(page, subjectSelectName) {
  const onCriteria = async () =>
    (await page.locator(`select[name="${subjectSelectName}"]`).count()) > 0;

  // Already on criteria page (error happened before Search was clicked)
  if (await onCriteria()) {
    console.log('  Already on criteria page');
    return;
  }

  // Strategy 1: goBack from results page → criteria page
  try {
    await page.goBack({ waitUntil: 'networkidle' });
    if (await onCriteria()) {
      console.log('  ↩ Via goBack()');
      return;
    }
  } catch { /* fall through */ }

  // Strategy 2: full restart from page 1
  console.log('  ↩ Full restart from page 1...');
  await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await selectHunterCollege(page);
  await page.waitForLoadState('networkidle');
  await selectTerm(page);
  await clickSubmitButton(page, /Next/i);
  await page.waitForLoadState('networkidle');

  if (!(await onCriteria())) {
    throw new Error('Could not return to criteria page even after full restart');
  }
  console.log('  ↩ Via full restart');
}

// ── Form helpers ──────────────────────────────────────────────────────────────

async function selectHunterCollege(page) {
  try {
    await page.locator('label:has-text("Hunter College")').first().click();
    console.log('  ✓ Hunter College checked (label click)');
    return;
  } catch (e) {
    console.log('  · label click failed:', e.message);
  }

  const box = page.locator('input#HTR01, input[name="inst_selection"][value="HTR01"]').first();
  await box.scrollIntoViewIfNeeded();
  await box.check({ force: true });
  console.log('  ✓ Hunter College checked (#HTR01 + scroll)');
}

async function selectTerm(page) {
  const sel = page.locator('select[name="term_value"], select#t_pd').first();
  if (await sel.count() === 0) throw new Error('Term dropdown not found');
  await sel.selectOption({ label: '2026 Spring Term' });
  console.log('  ✓ Term set to 2026 Spring Term');
}

// Reads all subject options from the criteria page.
// Returns { options: [{ value, label }], selectName: string }
// so the caller can target the select precisely by name in subsequent calls.
async function getSubjectOptions(page) {
  const sel = await findSelectWithOption(page, /Computer Science/i);
  if (!sel) throw new Error('Subject dropdown not found on criteria page');

  const selectName = await sel.getAttribute('name');

  const options = await sel.evaluate(el =>
    [...el.options]
      .filter(o => o.value && o.value.trim() !== '')
      .map(o => ({ value: o.value.trim(), label: o.text.trim() }))
  );
  return { options, selectName };
}

async function selectInstructionMode(page) {
  try {
    const label = page.locator('label:has-text("In Person")').first();
    if (await label.count() > 0) {
      const forAttr = await label.getAttribute('for');
      if (forAttr) {
        const cb = page.locator(`input#${forAttr}`);
        if (await cb.count() > 0) {
          // Short timeout — don't block 30s just checking state
          const already = await cb.isChecked({ timeout: 2000 }).catch(() => false);
          if (already) return;
        }
      }
      await label.click();
      return;
    }
    // Fallback: locate by label text with a short timeout
    const cb = page.locator('input[type="checkbox"]').filter({ hasText: /In Person/i }).first();
    const already = await cb.isChecked({ timeout: 2000 }).catch(() => false);
    if (!already) await cb.check({ force: true });
  } catch (e) {
    console.log('  · selectInstructionMode non-fatal:', e.message);
  }
}

async function clickSubmitButton(page, labelRegex) {
  const inputs     = page.locator('input[type="submit"]');
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const val = await inputs.nth(i).getAttribute('value') ?? '';
    if (labelRegex.test(val)) { await inputs.nth(i).click(); return; }
  }

  const buttons  = page.locator('button');
  const btnCount = await buttons.count();
  for (let i = 0; i < btnCount; i++) {
    const txt = (await buttons.nth(i).textContent()) ?? '';
    if (labelRegex.test(txt.trim())) { await buttons.nth(i).click(); return; }
  }

  console.log(`  (no button matched ${labelRegex} — clicking first submit)`);
  await page.locator('input[type="submit"]').first().click();
}

// ── Generic helpers ───────────────────────────────────────────────────────────

async function findSelectWithOption(page, regex) {
  const selects = page.locator('select');
  const count   = await selects.count();
  for (let i = 0; i < count; i++) {
    const sel     = selects.nth(i);
    const options = await sel.locator('option').allTextContents();
    if (options.some(text => regex.test(text))) return sel;
  }
  return null;
}

async function shot(page, name) {
  const file = path.join(DATA_DIR, `debug-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}`);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Parser ────────────────────────────────────────────────────────────────────

function parseSchedule(html, subject) {
  const $ = cheerio.load(html);
  const results = [];

  $('table.classinfo').each((_, table) => {
    const $t = $(table);

    const lines = (label) => {
      const cell = $t.find(`td[data-label="${label}"]`);
      if (!cell.length) return [];
      return cell.html()
        .split(/<br\s*\/?>/i)
        .map(frag => cheerio.load(frag).text().trim())
        .filter(Boolean);
    };

    const first = (label) => lines(label)[0] ?? null;

    const room = first('Room');
    if (!room || /\bTBA\b/i.test(room)) return;

    const daysAndTimes = lines('DaysAndTimes');
    if (!daysAndTimes.length || daysAndTimes.every(d => /\bTBA\b/i.test(d))) return;

    results.push({
      subjectCode:     subject.value,
      subjectName:     subject.label,
      classNumber:     first('Class Nbr'),
      section:         first('Section'),
      courseTopic:     first('Course Topic'),
      status:          first('Status'),
      instructionMode: first('Instruction Mode'),
      instructor:      lines('Instructor'),
      meetingDates:    first('Meeting Dates'),
      daysAndTimes,
      room,
    });
  });

  return results;
}

scrape();
