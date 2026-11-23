// Run with: node tests/logic.test.js
const assert = require('assert');
const L = require('../logic.js');

const now = new Date(2026, 10, 23); // Nov 23, 2026

// fullMonths
assert.strictEqual(L.fullMonths('2026-08-23', '', now), 3);
assert.strictEqual(L.fullMonths('2026-08-24', '', now), 2);
assert.strictEqual(L.fullMonths('2026-11-01', '', now), 0);
assert.strictEqual(L.fullMonths('2026-01-15', '2026-04-15', now), 3);
assert.strictEqual(L.fullMonths('', '', now), 0);
assert.strictEqual(L.fullMonths('2026-12-01', '', now), 0);

// referral bonus and tiers
assert.strictEqual(L.referralBonus(0), 0);
assert.strictEqual(L.referralBonus(1), 100);
assert.strictEqual(L.referralBonus(2), 200);
assert.strictEqual(L.referralBonus(3), 350);
assert.strictEqual(L.referralBonus(10), 200 + 8 * 150);
assert.strictEqual(L.tierFor(0), 'None yet');
assert.strictEqual(L.tierFor(2), 'Insider');
assert.strictEqual(L.tierFor(3), 'Ambassador');
assert.strictEqual(L.tierFor(10), 'Elite');

// board
const ambassadors = [
  { id: 'a1', name: 'Jen', type: 'Trainer', status: 'Active', code: 'JEN', redeemed: '50' },
  { id: 'a2', name: 'Mo', type: 'Influencer', status: 'Prospect', code: 'MO', redeemed: '' },
];
const leads = [
  { id: 'l1', ambassadorId: 'a1', date: '2026-08-01', stage: 'Recurring member', recurringSince: '2026-08-23' }, // 3 months
  { id: 'l2', ambassadorId: 'a1', date: '2026-09-10', stage: 'Cancelled', recurringSince: '2026-09-10', cancelledOn: '2026-11-10' }, // 2 months
  { id: 'l3', ambassadorId: 'a1', date: '2026-11-20', stage: 'Labs done' },
  { id: 'l4', ambassadorId: 'a1', date: '2026-11-21', stage: 'New' },
  { id: 'l5', ambassadorId: 'a2', date: '2026-11-22', stage: 'Lost' },
];
const board = L.computeBoard(ambassadors, leads, now);
const jen = board.find((r) => r.id === 'a1');
assert.strictEqual(board[0].id, 'a1');
assert.strictEqual(jen.leads, 4);
assert.strictEqual(jen.labs, 3);
assert.strictEqual(jen.converted, 2);
assert.strictEqual(jen.recurring, 1);
assert.strictEqual(jen.conv, 50);
assert.strictEqual(jen.tier, 'Insider');
assert.strictEqual(jen.bonus, 200);
assert.strictEqual(jen.monthly, 50); // (3 + 2) months x $10
assert.strictEqual(jen.earned, 250);
assert.strictEqual(jen.owed, 200);
assert.strictEqual(jen.perMonth, 10);

const totals = L.computeTotals(board, leads, now);
assert.strictEqual(totals.active, 1);
assert.strictEqual(totals.leads, 5);
assert.strictEqual(totals.leadsMonth, 3);
assert.strictEqual(totals.recurring, 1);
assert.strictEqual(totals.conv, 40);
assert.strictEqual(totals.owed, 200);
assert.strictEqual(totals.perMonth, 10);

const weekly = L.computeWeekly(leads, now);
assert.strictEqual(weekly.length, 12);
assert.strictEqual(weekly[11].week, '2026-11-23'); // Monday
assert.strictEqual(weekly[10].leads, 3); // Nov 16–22
const funnel = L.computeFunnel(leads);
assert.deepStrictEqual(funnel.map((r) => r.n), [5, 3, 3, 2, 1]);

console.log('All logic tests passed.');
