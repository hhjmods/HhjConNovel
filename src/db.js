const DB_NAME = 'hhj-con-novel';
const DB_VERSION = 1;
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('packages')) db.createObjectStore('packages', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cons')) {
        const cons = db.createObjectStore('cons', { keyPath: 'id' });
        cons.createIndex('packageId', 'packageId', { unique: false });
      }
      if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await callback(store);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

export async function getAll(storeName) { return withStore(storeName, 'readonly', store => requestAsPromise(store.getAll())); }
export async function getOne(storeName, key) { return withStore(storeName, 'readonly', store => requestAsPromise(store.get(key))); }
export async function putOne(storeName, value) { return withStore(storeName, 'readwrite', store => requestAsPromise(store.put(value))); }
export async function putMany(storeName, values) {
  if (!values.length) return;
  return withStore(storeName, 'readwrite', store => { values.forEach(value => store.put(value)); return Promise.resolve(); });
}
export async function deleteOne(storeName, key) { return withStore(storeName, 'readwrite', store => requestAsPromise(store.delete(key))); }
export async function clearStore(storeName) { return withStore(storeName, 'readwrite', store => requestAsPromise(store.clear())); }
export async function replaceStores(storeValues) {
  const names = Object.keys(storeValues);
  if (!names.length) return;
  const db = await openDb();
  const tx = db.transaction(names, 'readwrite');
  names.forEach(name => {
    const store = tx.objectStore(name);
    store.clear();
    storeValues[name].forEach(value => store.put(value));
  });
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
