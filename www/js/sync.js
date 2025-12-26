/**
 * SyncManager
 * Handles checking network status and processing the offline queue.
 */
class SyncManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.isSyncing = false;
        this.networkStatus = navigator.onLine ? 'online' : 'offline';

        this.init();
    }

    init() {
        window.addEventListener('online', () => {
            console.log('SyncManager: Network is ONLINE');
            this.networkStatus = 'online';
            this.triggerSync();
            this.updateUIStatus();
        });

        window.addEventListener('offline', () => {
            console.log('SyncManager: Network is OFFLINE');
            this.networkStatus = 'offline';
            this.updateUIStatus();
        });

        // Try to sync on startup (if online)
        if (this.networkStatus === 'online') {
            setTimeout(() => this.triggerSync(), 2000);
        }
    }

    updateUIStatus() {
        // Dispatch a custom event specifically for the UI to listen to
        const event = new CustomEvent('network-status-change', {
            detail: { status: this.networkStatus }
        });
        window.dispatchEvent(event);
    }

    async triggerSync() {
        if (this.isSyncing || this.networkStatus === 'offline') return;

        this.isSyncing = true;
        console.log('SyncManager: Starting sync process...');

        // Notify UI sync started
        window.dispatchEvent(new CustomEvent('sync-start'));

        try {
            const pendingLogs = await window.localDB.getPendingLogs();
            if (pendingLogs.length === 0) {
                console.log('SyncManager: No pending logs to sync.');
                this.isSyncing = false;
                window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: true, count: 0 } }));
                return;
            }

            console.log(`SyncManager: Found ${pendingLogs.length} pending logs.`);

            let successCount = 0;
            let failCount = 0;

            for (const log of pendingLogs) {
                try {
                    // Send to API
                    // Note: We use the EXACT same payload structure expected by the API
                    const logPayload = {
                        contagem_id: log.contagem_id,
                        usuario_id: log.usuario_id,
                        item_id: log.item_id,
                        estoque: log.estoque,
                        contado: log.contado,
                        identificador_item: log.identificador_item
                    };

                    await this.sendToApi(logPayload);

                    // Mark as synced in DB
                    await window.localDB.markLogAsSynced(log.id);
                    successCount++;

                } catch (error) {
                    console.error(`SyncManager: Failed to sync log ID ${log.id}`, error);
                    failCount++;
                }
            }

            console.log(`SyncManager: Sync complete. Success: ${successCount}, Failed: ${failCount}`);
            window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: true, count: successCount, failed: failCount } }));

        } catch (error) {
            console.error('SyncManager: Critical error during sync', error);
            window.dispatchEvent(new CustomEvent('sync-end', { detail: { success: false } }));
        } finally {
            this.isSyncing = false;
        }
    }

    async sendToApi(data) {
        // Reuse the makeRequest logic or fetch directly
        // We assume global API_BASE_URL is available or passed in constructor.
        // But for safety, let's use the one passed or global.
        const baseUrl = this.apiBaseUrl || window.API_BASE_URL;

        const response = await fetch(`${baseUrl}/estoque/contagem/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        return await response.json();
    }
}

// Initialize on window load (after app.js defines API_BASE_URL)
window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure API_BASE_URL is defined if it's in app.js
    setTimeout(() => {
        if (window.API_BASE_URL) {
            window.syncManager = new SyncManager(window.API_BASE_URL);
        } else {
            console.warn('SyncManager: API_BASE_URL not found, waiting...');
        }
    }, 1000);
});
