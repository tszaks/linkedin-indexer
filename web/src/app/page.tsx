'use client';

import { useState, useEffect, useCallback } from 'react';

interface Connection {
  id: number;
  profile_url: string;
  name: string;
  headline?: string;
  company?: string;
  title?: string;
  location?: string;
  image_url?: string;
  indexed_at?: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchConnections = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/connections?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setConnections(data.connections || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError('Failed to load connections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    searchConnections('');
  }, [searchConnections]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchConnections(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchConnections]);

  const highlightMatch = (text: string | undefined, searchQuery: string) => {
    if (!text || !searchQuery) return text || '';
    const terms = searchQuery.toLowerCase().split(/\s+/);
    let result = text;
    terms.forEach(term => {
      if (term) {
        const regex = new RegExp(`(${term})`, 'gi');
        result = result.replace(regex, '<mark class="bg-blue-100 dark:bg-blue-900 rounded px-0.5">$1</mark>');
      }
    });
    return result;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">
            🔗 LinkedIn Connection Search
          </h1>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, title, company..."
              className="w-full px-4 py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-xl 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Searching...' : (
              query
                ? `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${query}"`
                : `${totalCount} connection${totalCount !== 1 ? 's' : ''} indexed`
            )}
          </div>
        </div>
      </header>

      {/* Results */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
          </div>
        )}

        {!loading && connections.length === 0 && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <div className="text-5xl mb-4">🔍</div>
            {query ? (
              <>
                <p className="text-lg">No connections found for &quot;{query}&quot;</p>
                <p className="text-sm mt-2">Try different search terms</p>
              </>
            ) : (
              <>
                <p className="text-lg">No connections indexed yet</p>
                <p className="text-sm mt-2">Use the Chrome extension to start indexing</p>
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          {connections.map((conn) => (
            <a
              key={conn.id}
              href={conn.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm 
                       hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {conn.image_url ? (
                    <img
                      src={conn.image_url}
                      alt={conn.name}
                      className="w-14 h-14 rounded-full object-cover bg-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conn.name)}&background=0a66c2&color=fff`;
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold">
                      {conn.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-gray-900 dark:text-white truncate"
                    dangerouslySetInnerHTML={{ __html: highlightMatch(conn.name, query) }}
                  />
                  <p
                    className="text-sm text-gray-600 dark:text-gray-300 truncate"
                    dangerouslySetInnerHTML={{ __html: highlightMatch(conn.headline || conn.title, query) }}
                  />
                  {conn.company && (
                    <p
                      className="text-sm text-blue-600 dark:text-blue-400 truncate mt-0.5"
                      dangerouslySetInnerHTML={{ __html: highlightMatch(conn.company, query) }}
                    />
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
        LinkedIn Connection Indexer
      </footer>
    </div>
  );
}
