'use client';

import { useState, useEffect, useCallback } from 'react';

interface Connection {
  id: string;
  profile_url: string;
  name: string;
  headline?: string;
  company?: string;
  title?: string;
  location?: string;
  image_url?: string;
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

  useEffect(() => {
    searchConnections('');
  }, [searchConnections]);

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
        result = result.replace(regex, '<mark class="bg-yellow-200/60 dark:bg-yellow-500/30 rounded-sm px-0.5">$1</mark>');
      }
    });
    return result;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#1d1d1f] transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#1d1d1f]/80 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <h1 className="text-[28px] font-semibold tracking-tight text-gray-900 dark:text-white text-center mb-5">
            Connections
          </h1>

          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full h-[38px] pl-10 pr-10 text-[15px] rounded-xl
                       bg-gray-100 dark:bg-gray-800/60 
                       text-gray-900 dark:text-white
                       placeholder-gray-500 dark:placeholder-gray-400
                       border-0 focus:ring-2 focus:ring-blue-500/50
                       transition-all duration-200"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <div className="w-4 h-4 rounded-full bg-gray-400 dark:bg-gray-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </button>
            )}
          </div>

          {/* Count */}
          <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mt-3">
            {loading ? 'Searching...' : (
              query
                ? `${totalCount} result${totalCount !== 1 ? 's' : ''}`
                : `${totalCount} connection${totalCount !== 1 ? 's' : ''}`
            )}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-center text-[15px] mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && connections.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-[17px] font-medium text-gray-900 dark:text-white">
              {query ? 'No Results' : 'No Connections Yet'}
            </p>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 mt-1">
              {query ? 'Try a different search' : 'Install the Chrome extension to start indexing'}
            </p>
          </div>
        )}

        {!loading && connections.length > 0 && (
          <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl overflow-hidden shadow-sm">
            {connections.map((conn, index) => (
              <a
                key={conn.id}
                href={conn.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-4 px-4 py-3 
                         hover:bg-gray-50 dark:hover:bg-white/5 
                         active:bg-gray-100 dark:active:bg-white/10
                         transition-colors duration-150
                         ${index !== 0 ? 'border-t border-gray-100 dark:border-gray-700/50' : ''}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {conn.image_url ? (
                    <img
                      src={conn.image_url}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover bg-gray-200 dark:bg-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[17px] font-medium">
                      {conn.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[17px] font-medium text-gray-900 dark:text-white truncate"
                    dangerouslySetInnerHTML={{ __html: highlightMatch(conn.name, query) }}
                  />
                  <p
                    className="text-[15px] text-gray-500 dark:text-gray-400 truncate"
                    dangerouslySetInnerHTML={{ __html: highlightMatch(conn.headline || conn.title || conn.company, query) }}
                  />
                </div>

                {/* Chevron */}
                <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-[13px] text-gray-400 dark:text-gray-500">
        LinkedIn Connection Indexer
      </footer>
    </div>
  );
}
