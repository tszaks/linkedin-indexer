import PocketBase from 'pocketbase';

// Get PocketBase URL - use env var or fallback
const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Create PocketBase client lazily to avoid issues during build
function getPocketBase() {
    return new PocketBase(POCKETBASE_URL);
}

export interface Connection {
    id?: string;
    profile_url: string;
    name: string;
    headline?: string;
    company?: string;
    title?: string;
    location?: string;
    image_url?: string;
    created?: string;
    updated?: string;
}

// Search connections
export async function searchConnections(query: string): Promise<Connection[]> {
    try {
        const pb = getPocketBase();
        let filter = '';

        if (query && query.trim()) {
            const terms = query.trim().split(/\s+/);
            // Escape special characters in search terms
            const conditions = terms.map(term => {
                const escaped = term.replace(/"/g, '\\"');
                return `(name ~ "${escaped}" || company ~ "${escaped}" || title ~ "${escaped}" || headline ~ "${escaped}")`;
            });
            filter = conditions.join(' && ');
        }

        const records = await pb.collection('connections').getFullList<Connection>({
            filter,
            sort: 'name',
        });

        return records;
    } catch (error) {
        console.error('Error searching connections:', error);
        return [];
    }
}

// Get all connections
export async function getAllConnections(): Promise<Connection[]> {
    try {
        const pb = getPocketBase();
        const records = await pb.collection('connections').getFullList<Connection>({
            sort: 'name',
        });
        return records;
    } catch (error) {
        console.error('Error getting connections:', error);
        return [];
    }
}

// Get connection count
export async function getConnectionCount(): Promise<number> {
    try {
        const pb = getPocketBase();
        const result = await pb.collection('connections').getList(1, 1);
        return result.totalItems;
    } catch (error) {
        console.error('Error getting count:', error);
        return 0;
    }
}

// Upsert a connection (create or update by profile_url)
export async function upsertConnection(connection: Connection): Promise<Connection | null> {
    try {
        const pb = getPocketBase();
        // Check if exists
        const existing = await pb.collection('connections').getFirstListItem(
            `profile_url = "${connection.profile_url.replace(/"/g, '\\"')}"`
        ).catch(() => null);

        if (existing) {
            // Update
            return await pb.collection('connections').update<Connection>(existing.id, connection);
        } else {
            // Create
            return await pb.collection('connections').create<Connection>(connection);
        }
    } catch (error) {
        console.error('Error upserting connection:', error);
        return null;
    }
}

// Bulk upsert connections
export async function upsertConnections(connections: Connection[]): Promise<number> {
    let count = 0;

    for (const conn of connections) {
        const result = await upsertConnection(conn);
        if (result) count++;
    }

    return count;
}
