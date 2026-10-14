export function accountScopedStorageKey(prefix, userId) {
  if (typeof prefix !== 'string' || !prefix.trim()) return null;
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `${prefix}:${encodeURIComponent(userId)}`;
}
