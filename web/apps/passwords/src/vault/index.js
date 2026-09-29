import { decryptItem, decryptItemWithFolderKey } from './crypto.js'

// v1 stores all fields in one blob. Decryption is transient here; only these
// seven fields cross the return boundary. crypto.js zeroes mutable plaintext.
export const buildIndexEntry = async (record, { vaultKey, folderKey = null, source = 'owned' }) => {
  let full
  if (vaultKey && record.wrappedItemKey) {
    try { full = await decryptItem(vaultKey, record) } catch { /* a stale owner copy may have a valid folder copy */ }
  }
  if (!full && folderKey && record.folderWrappedItemKey) {
    try { full = await decryptItemWithFolderKey(folderKey, record) } catch { /* list the unreadable entry */ }
  }
  return {
    id: record.id,
    folderId: record.folderId || null,
    title: full ? full.title : "Can't open this entry",
    username: full ? full.username : '',
    url: full ? full.url : '',
    rev: Number.isInteger(record.rev) ? record.rev : 0,
    source
  }
}
