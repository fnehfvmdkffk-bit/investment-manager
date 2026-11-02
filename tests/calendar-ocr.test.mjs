import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseCalendarTsv} from '../lib/calendar-ocr.js';
// OCR transcript from the official image in RISE notice 846, inspected 2026-11-02.
const tsv=fs.readFileSync(new URL('./fixtures/rise-calendar.tsv',import.meta.url),'utf8');
test('reads actual official calendar labels, month marker, and weekday columns',()=>{assert.deepEqual(parseCalendarTsv(tsv,{year:2026,month:10}),{recordDate:'2026-10-30',payDate:'2026-11-03'})});
test('does not infer a payment date without its label',()=>{assert.equal(parseCalendarTsv(tsv.replace('예정일','unknown'),{year:2026,month:10}),null)});
test('rejects a plausible OCR day that contradicts its weekday column',()=>{assert.equal(parseCalendarTsv(tsv.replace(/\t30\n/,'\t31\n'),{year:2026,month:10}),null)});
test('rejects reuse of a calendar under the wrong notice year',()=>{assert.equal(parseCalendarTsv(tsv,{year:2027,month:10}),null)});
