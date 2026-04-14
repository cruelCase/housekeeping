'use client';

import { useEffect, useState } from 'react';

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ArchivedRoute {
  id: number;
  dts_document_id: number | null;
  previous_route_id: number | null;
  created_at: string;
  updated_at: string;
}

export default function RouteArchivesPage() {
  const [routes, setRoutes] = useState<ArchivedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState<Pagination | null>(null);

  useEffect(() => {
    loadArchivedRoutes();
  }, [page, order]);

  const loadArchivedRoutes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/archived-routes?page=${page}&order=${order}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load archived routes');
      }

      setRoutes(data.routes || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading archived routes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={loadArchivedRoutes}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-purple-600">
                Route Archives
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Archived Document Routes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                View document routes that have been automatically archived to improve performance.
              </p>
              <div className="mt-4 flex gap-2 items-center">
                <span className="text-sm text-slate-600">Order:</span>
                <button
                  onClick={() => {
                    setOrder('desc');
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-sm rounded ${order === 'desc' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  Newest First
                </button>
                <button
                  onClick={() => {
                    setOrder('asc');
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-sm rounded ${order === 'asc' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                >
                  Oldest First
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 text-right">
              <button
                onClick={() => window.location.href = '/house-keeping'}
                className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Back to House Keeping
              </button>
              <div>
                <p className="text-sm text-slate-500">
                  Page {pagination?.currentPage || 1} of {pagination?.totalPages || 1} ({pagination?.totalItems || 0} total routes)
                </p>
                <p className="text-2xl font-semibold">{routes.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/40">
          {routes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No archived routes found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Document ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Previous Route ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Created At</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={route.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900">{route.id}</td>
                      <td className="py-3 px-4 text-slate-600">{route.dts_document_id || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-600">{route.previous_route_id || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(route.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(route.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagination && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasNext}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}