// Small helpers used by the data generator.

// ---------- Seeded random numbers ----------
// Math.random() gives different numbers every run. This "mulberry32" generator gives the
// SAME sequence for the same seed, so the generated data is repeatable (Section 6 requirement).
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // number between 0 and 1
  }
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min, // whole number min..max
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
  };
}

// ---------- Dates (always 'YYYY-MM-DD' strings, calculated in UTC) ----------
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

export function monthStart(date) {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(monthStartDate, months) {
  const d = new Date(`${monthStartDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function lastDayOfMonth(monthStartDate) {
  return addDays(addMonths(monthStartDate, 1), -1);
}

// List of month-start dates from `from` to `to` (inclusive).
export function monthsBetween(from, to) {
  const months = [];
  for (let m = monthStart(from); m <= monthStart(to); m = addMonths(m, 1)) months.push(m);
  return months;
}

export function timestamp(date, hour = 10) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00Z`;
}

// ---------- Money ----------
export function round2(value) {
  return Math.round(value * 100) / 100;
}

// Split `total` into parts proportional to `weights`, rounded to 2 decimals,
// with the last part absorbing the rounding so the parts add up EXACTLY to the total.
export function splitAmount(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => round2((total * w) / sum));
  const drift = round2(total - parts.reduce((a, b) => a + b, 0));
  parts[parts.length - 1] = round2(parts[parts.length - 1] + drift);
  return parts;
}
