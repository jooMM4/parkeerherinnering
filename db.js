const DB_NAME = 'parkeerherinnering';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const MAX_HISTORY = 5;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode, run) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = run(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAll() {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

export function saveSession(session) {
  return withStore('readwrite', (store) => {
    store.put(session);
  });
}

export async function getActiveSession() {
  const all = await getAll();
  return all.find((s) => s.active) || null;
}

export async function getHistory() {
  const all = await getAll();
  return all
    .filter((s) => !s.active)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_HISTORY);
}

export async function endActiveSession() {
  const active = await getActiveSession();
  if (!active) return;
  active.active = false;
  await saveSession(active);

  const all = await getAll();
  const history = all
    .filter((s) => !s.active)
    .sort((a, b) => b.timestamp - a.timestamp);
  const excess = history.slice(MAX_HISTORY);
  if (excess.length > 0) {
    await withStore('readwrite', (store) => {
      excess.forEach((s) => store.delete(s.id));
    });
  }
}
