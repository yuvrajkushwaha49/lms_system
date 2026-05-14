const STORAGE_KEY = "lms_blocked_dm_member_ids";

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  } catch {
    return [];
  }
}

export function getBlockedDmMemberIds() {
  return readIds();
}

export function addBlockedDmMemberId(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return;
  const next = new Set(readIds());
  next.add(n);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
}

export function isDmBlockedMemberId(id) {
  return readIds().includes(Number(id));
}
