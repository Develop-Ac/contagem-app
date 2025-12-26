/**
 * LocalDB - Wrapper for Dexie.js (Robust IndexedDB)
 * Handles local storage for counts, items, and pending logs.
 */
class LocalDB {
    constructor() {
        this.dbName = 'ContagemAppDB';
        // Define Database and Schema
        this.db = new Dexie(this.dbName);

        this.db.version(4).stores({
            logs: '++id, contagem_id, contagem_num, item_id, synced, creationTime',
            app_cache: 'key' // 'key' is the primary key
        });

        this.db.open().then(() => {
            console.log("LocalDB (Dexie): Database opened successfully.");
        }).catch(err => {
            console.error("LocalDB (Dexie): Failed to open db", err);
        });
    }

    // --- LOGS (Queue system) ---

    async addLog(logData) {
        const entry = {
            ...logData,
            synced: 0, // 0 = false, 1 = true
            creationTime: new Date().getTime()
        };
        return await this.db.logs.add(entry);
    }

    async getPendingLogs() {
        // Get all logs where synced matches 0
        return await this.db.logs.where('synced').equals(0).toArray();
    }

    async getLogsByContagemNum(contagemNum) {
        if (!contagemNum) return [];
        // Dexie handles type conversion, but strict equality is safer given our history.
        // We'll trust Dexie's weak typing or try both if needed.
        // Usually Dexie is strict. Let's try direct query first.
        const num = Number(contagemNum);
        return await this.db.logs.where('contagem_num').equals(num).toArray();
    }

    async getLogsByContagem(contagemId) {
        if (!contagemId) return [];
        // Support both string and number lookup just in case
        const strId = String(contagemId);
        const numId = Number(contagemId);

        const logsStr = await this.db.logs.where('contagem_id').equals(strId).toArray();
        let logsNum = [];
        if (!isNaN(numId)) {
            logsNum = await this.db.logs.where('contagem_id').equals(numId).toArray();
        }

        // Merge and deduplicate by ID
        const map = new Map();
        logsStr.forEach(l => map.set(l.id, l));
        logsNum.forEach(l => map.set(l.id, l));

        return Array.from(map.values());
    }

    async markLogAsSynced(id) {
        return await this.db.logs.update(id, { synced: 1 });
    }

    async deleteLog(id) {
        return await this.db.logs.delete(id);
    }

    async clearLogsByContagem(contagemId) {
        // This might delete synced ones too if used improperly, but standardizing 'delete' logic
        // Usually we only clear cache, not logs. Keeping for compatibility.
        // Finding logs to delete:
        const logs = await this.getLogsByContagem(contagemId);
        const ids = logs.map(l => l.id);
        return await this.db.logs.bulkDelete(ids);
    }

    // --- CACHE (Contagens & Itens) ---

    async saveCache(key, data) {
        return await this.db.app_cache.put({
            key: key,
            data: data,
            timestamp: new Date().getTime()
        });
    }

    async getCache(key) {
        const result = await this.db.app_cache.get(key);
        return result ? result.data : null;
    }

    async clearCache(key) {
        return await this.db.app_cache.delete(key);
    }

    // --- UTILS ---
    async updateEstoqueByItem(identificadorItem, novoEstoque) {
        // Atualiza o campo 'estoque' de todos os logs que tiverem esse identificador
        // Usado para replicar o estoque real recuperado da API para os logs locais
        return await this.db.logs
            .where('identificador_item').equals(identificadorItem)
            .modify({ estoque: novoEstoque });
    }
}

// Export global instance
window.localDB = new LocalDB();
