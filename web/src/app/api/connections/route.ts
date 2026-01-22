import { NextRequest, NextResponse } from 'next/server';
import { searchConnections, upsertConnections, getConnectionCount, Connection } from '@/lib/db';

// Simple API key auth for write operations
function isAuthorized(request: NextRequest): boolean {
    const apiKey = request.headers.get('x-api-key');
    return apiKey === process.env.API_KEY;
}

// GET /api/connections?q=search+term
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q') || '';
        const countOnly = searchParams.get('count') === 'true';

        if (countOnly) {
            const count = await getConnectionCount();
            return NextResponse.json({ count });
        }

        const connections = await searchConnections(query);
        return NextResponse.json({
            connections,
            count: connections.length,
            query
        });
    } catch (error) {
        console.error('Error fetching connections:', error);
        return NextResponse.json(
            { error: 'Failed to fetch connections' },
            { status: 500 }
        );
    }
}

// POST /api/connections - Add/update connections (requires API key)
export async function POST(request: NextRequest) {
    try {
        // Check authorization
        if (!isAuthorized(request)) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const connections: Connection[] = Array.isArray(body) ? body : [body];

        // Validate connections
        for (const conn of connections) {
            if (!conn.profile_url || !conn.name) {
                return NextResponse.json(
                    { error: 'Each connection must have profile_url and name' },
                    { status: 400 }
                );
            }
        }

        const count = await upsertConnections(connections);

        return NextResponse.json({
            success: true,
            count,
            message: `Successfully synced ${count} connection(s)`
        });
    } catch (error) {
        console.error('Error saving connections:', error);
        return NextResponse.json(
            { error: 'Failed to save connections' },
            { status: 500 }
        );
    }
}
