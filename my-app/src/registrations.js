// Mock join/registration persistence, scoped to this browser.
// TODO: replace with real POST/DELETE /api/tournaments/:id/register calls
// once the backend has a Tournament model + registration endpoint.

const STORAGE_KEY = "cc_registrations";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// key registrations per-user so switching accounts on the same browser
// doesn't leak someone else's registrations
function keyFor(userId) {
  return userId || "anonymous";
}

export function getRegistration(userId, tournamentId) {
  const all = readAll();
  return all[keyFor(userId)]?.[tournamentId] || null;
}

export function joinTournament(userId, tournamentId, entry) {
  const all = readAll();
  const userKey = keyFor(userId);
  all[userKey] = all[userKey] || {};
  all[userKey][tournamentId] = { ...entry, joinedAt: new Date().toISOString() };
  writeAll(all);
}

export function leaveTournament(userId, tournamentId) {
  const all = readAll();
  const userKey = keyFor(userId);
  if (all[userKey]) {
    delete all[userKey][tournamentId];
    writeAll(all);
  }
}