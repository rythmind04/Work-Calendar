const DAY_MS = 86_400_000;

export function dateKey(year, month, day) {
  return [String(year).padStart(4, "0"), String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

export function dayNumber(key) {
  return Date.parse(key + "T00:00:00Z") / DAY_MS;
}

export function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function patternLabel(pattern) {
  return pattern === 5 ? "5/2" : pattern + "/" + pattern;
}

export function shiftOn(profile, key) {
  if (!profile) return null;
  if (Object.hasOwn(profile.overrides, key)) return profile.overrides[key];
  const elapsed = dayNumber(key) - dayNumber(profile.start);
  if (elapsed < 0) return null;
  if (profile.pattern === 5) {
    const weekday = ((dayNumber(key) + 3) % 7 + 7) % 7;
    return weekday < 5;
  }
  return elapsed % (profile.pattern * 2) < profile.pattern;
}

export function toggleShift(profile, key) {
  const next = shiftOn(profile, key) !== true;
  const overrides = { ...profile.overrides };
  delete overrides[key];
  const updated = { ...profile, overrides };
  if (shiftOn(updated, key) !== next) overrides[key] = next;
  return updated;
}

export function monthDays(year, month) {
  const first = dayNumber(dateKey(year, month, 1));
  const followingYear = year + Number(month === 11);
  const followingMonth = dayNumber(dateKey(followingYear, (month + 1) % 12, 1));
  const count = year === 9999 && month === 11 ? 31 : followingMonth - first;
  return Array.from({ length: count }, (_, i) => dateKey(year, month, i + 1));
}

export function sharedDays(keys, first, second) {
  if (!first || !second || first.id === second.id) return [];
  return keys.filter(key => shiftOn(first, key) === false && shiftOn(second, key) === false);
}
