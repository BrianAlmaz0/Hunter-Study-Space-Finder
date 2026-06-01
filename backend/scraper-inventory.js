// scraper-inventory.js
// Scrapes Hunter College room inventory from Spring 2026.
// Collects all unique physical rooms across all subjects.
// Does NOT touch the schedules collection or Summer data.
// Saves to backend/data/hunter-room-inventory-spring-2026.json
//
// Run: npm run scrape:inventory  (from the backend/ folder)

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, 'data');
const OUTPUT     = path.join(DATA_DIR, 'hunter-room-inventory-spring-2026.json');
const START_URL  = 'https://globalsearch.cuny.edu/CFGlobalSearchTool/search.jsp';
const DELAY_MS   = 1500;

const TARGET_INVENTORY_TERM = '2026 Spring Term';

// ── Room helpers (mirrors server.js) ─────────────────────────────────────────

function getBuildingFromRoom(room) {
  if (!room) return null;
  const r = room.trim();
  if (/^North\s+Bldg/i.test(r))  return 'North Building';
  if (/^West\s+Bldg/i.test(r))   return 'West Building';
  if (/^East\s+Bldg/i.test(r))   return 'East Building';
  if (/^ThomHunter/i.test(r))    return 'Thomas Hunter Hall';
  if (/^Baker/i.test(r))         return 'Baker Building';
  if (/^Silberman/i.test(r))     return 'Silberman';
  if (/^Roosevelt/i.test(r))     return 'Roosevelt House';
  return null;
}

function getRoomNumber(room) {
  const parts = room.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// inferFloor(roomNumber, building) — must stay in sync with server.js version.
function inferFloor(roomNumber, building) {
  const trimmed = roomNumber.trim();
  if (/^C/i.test(trimmed)) return 'C';
  if (building === 'West Building' && (/^WB\d/i.test(trimmed) || /^B\d/i.test(trimmed))) return 'B';
  if (building === 'East Building' && /^B[12]$/i.test(trimmed)) return 'B';
  const m = trimmed.match(/\d+/);
  if (!m) return 1;
  const digits = m[0];
  if (digits.length <= 3) return parseInt(digits[0]) || 1;
  return parseInt(digits.slice(0, 2)) || 1;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function scrapeInventory() {
  mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page    = await browser.newPage();
  page.setDefaultTimeout(30_000);

  const roomSet  = new Map(); // room string → inventory doc
  const failed   = [];
  let attempted  = 0;
  let successful = 0;

  try {
    console.log('\n[STEP 1] Loading CUNY Global Search...');
    await page.goto(START_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    console.log('[STEP 2] Selecting Hunter College...');
    await selectHunterCollege(page);
    await page.waitForLoadState('networkidle');

    console.log(`[STEP 3] Selecting ${TARGET_INVENTORY_TERM}...`);
    await selectTerm(page);

    console.log('[STEP 4] Clicking Next...');
    await clickSubmitButton(page, /Next/i);
    await page.waitForLoadState('networkidle');

    console.log('[STEP 5] Reading subject options...');
    const { options: subjects, selectName: subjectSelectName } = await getSubjectOptions(page);
    console.log(`  Found ${subjects.length} subjects`);

    console.log('[STEP 6] Setting Instruction Mode to In Person...');
    await selectInstructionMode(page);

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      attempted++;

      console.log(`\n[Subject ${i + 1}/${subjects.length}] ${subject.label} (${subject.value})`);

      try {
        const subjectSel = page.locator(`select[name="${subjectSelectName}"]`);
        if (await subjectSel.count() === 0) {
          throw new Error(`Subject select not found`);
        }
        await subjectSel.selectOption({ value: subject.value });
        await selectInstructionMode(page);
        await clickSubmitButton(page, /Search/i);
        await page.waitForLoadState('networkidle', { timeout: 60_000 });

        const html  = await page.content();
        const rooms = parseRooms(html);
        let newCount = 0;
        for (const r of rooms) {
          if (!roomSet.has(r.room)) {
            roomSet.set(r.room, r);
            newCount++;
          }
        }
        console.log(`  ✓ ${rooms.length} physical rooms found (${newCount} new, ${roomSet.size} total unique)`);
        successful++;

        // Intermediate save after each subject
        writeFileSync(OUTPUT, JSON.stringify([...roomSet.values()], null, 2), 'utf8');

        if (i < subjects.length - 1) {
          await returnToCriteria(page, subjectSelectName);
          await delay(DELAY_MS);
        }
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        failed.push({ value: subject.value, label: subject.label, error: err.message });
        try {
          await returnToCriteria(page, subjectSelectName);
          await delay(DELAY_MS);
        } catch {
          console.error('  ✗ Recovery failed — aborting');
          break;
        }
      }
    }

  } catch (err) {
    console.error('\n✗ Inventory scraper failed:', err.message);
    throw err;
  } finally {
    const inventory = [...roomSet.values()];
    writeFileSync(OUTPUT, JSON.stringify(inventory, null, 2), 'utf8');

    console.log('\n══════════════════════════════════════');
    console.log(`✓ Subjects attempted:  ${attempted}`);
    console.log(`✓ Subjects successful: ${successful}`);
    console.log(`✓ Unique physical rooms: ${inventory.length}`);
    console.log(`✗ Failed subjects:     ${failed.length}`);
    console.log(`  Saved → ${OUTPUT}`);
    console.log('══════════════════════════════════════\n');

    try { await browser.close(); } catch { /* already closed */ }
  }
}

// Matches multiple building name occurrences — used to reject concatenated/corrupt entries.
const BUILDING_NAME_RE = /\b(North|West|East)\s+Bldg\b|ThomHunter|Silberman|Baker|Roosevelt/gi;

// ── HTML parser (rooms only) ──────────────────────────────────────────────────

function parseRooms(html) {
  const $ = cheerio.load(html);
  const rooms = [];

  $('table.classinfo').each((_, table) => {
    const $t = $(table);

    const first = (label) => {
      const cell = $t.find(`td[data-label="${label}"]`);
      if (!cell.length) return null;
      return cheerio.load(cell.html()).text().trim() || null;
    };

    const room = first('Room');
    if (!room || /\bTBA\b/i.test(room)) return;
    if (/^online/i.test(room.trim())) return;
    // Reject corrupt entries where two room strings were concatenated by the scraper
    if ((room.match(BUILDING_NAME_RE) || []).length > 1) return;

    const mode = first('Instruction Mode') || '';
    if (/^online\s+(synchronous|asynchronous|mix)/i.test(mode)) return;

    const building = getBuildingFromRoom(room);
    if (!building) return;

    const roomNumber = getRoomNumber(room);
    const floor      = inferFloor(roomNumber, building);

    rooms.push({
      room,
      building,
      floor,
      normalizedRoomName: room.toLowerCase().replace(/\s+/g, '-'),
    });
  });

  return rooms;
}

// ── Navigation helpers (mirrors scraper.js) ───────────────────────────────────

async function returnToCriteria(page, subjectSelectName) {
  const onCriteria = async () =>
    (await page.locator(`select[name="${subjectSelectName}"]`).count()) > 0;

  if (await onCriteria()) {
    console.log('  Already on criteria page');
    return;
  }

  try {
    await page.goBack({ waitUntil: 'networkidle' });
    if (await onCriteria()) {
      console.log('  ↩ Via goBack()');
      return;
    }
  } catch { /* fall through */ }

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
  await sel.selectOption({ label: TARGET_INVENTORY_TERM });
  console.log(`  ✓ Term set to ${TARGET_INVENTORY_TERM}`);
}

async function getSubjectOptions(page) {
  const sel = await findSelectWithOption(page, /Computer Science/i);
  if (!sel) throw new Error('Subject dropdown not found');
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
          const already = await cb.isChecked({ timeout: 2000 }).catch(() => false);
          if (already) return;
        }
      }
      await label.click();
      return;
    }
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
  await page.locator('input[type="submit"]').first().click();
}

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

scrapeInventory();
