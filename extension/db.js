// IndexedDB wrapper for LinkedIn connections storage

const DB_NAME = 'LinkedInIndexer';
const DB_VERSION = 1;
const STORE_NAME = 'connections';

class ConnectionDB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'profileUrl' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('company', 'company', { unique: false });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('indexedAt', 'indexedAt', { unique: false });
        }
      };
    });
  }

  async saveConnection(connection) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Add timestamp
      connection.indexedAt = Date.now();
      
      const request = store.put(connection);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(connection);
    });
  }

  async saveConnections(connections) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      let saved = 0;
      connections.forEach(conn => {
        conn.indexedAt = Date.now();
        const request = store.put(conn);
        request.onsuccess = () => saved++;
      });
      
      transaction.oncomplete = () => resolve(saved);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllConnections() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getCount() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async search(query) {
    const connections = await this.getAllConnections();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) return connections;
    
    const terms = lowerQuery.split(/\s+/);
    
    return connections.filter(conn => {
      const searchable = [
        conn.name,
        conn.headline,
        conn.company,
        conn.title,
        conn.location
      ].filter(Boolean).join(' ').toLowerCase();
      
      return terms.every(term => searchable.includes(term));
    });
  }

  async clear() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export for use in content script and popup
if (typeof window !== 'undefined') {
  window.ConnectionDB = ConnectionDB;
}
