'use client';

import { useEffect, useMemo, useState } from 'react';

interface Document {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
}

interface DocumentRow {
  id: number;
  document_name: string;
  created_at: string;
  archived: number;
}

interface DocumentsResponse {
  documents: DocumentRow[];
  totalDocuments: number;
  activeCount: number;
  archivedCount: number;
  page: number;
}

const PAGE_SIZE = 10;

export default function HouseKeepingPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [newDocName, setNewDocName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);

  const fetchDocuments = async (
    page: number,
    archived: boolean
  ): Promise<DocumentsResponse | null> => {
    try {
      const response = await fetch(
        `/api/documents?page=${page}&archived=${archived ? 1 : 0}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to load documents.');
      }

      return payload as DocumentsResponse;
    } catch (error) {
      console.error('fetchDocuments error:', error);
      return null;
    }
  };

  const loadDocuments = async (
    page = 1,
    archived = activeTab === 'archived'
  ) => {
    const payload = await fetchDocuments(page, archived);
    if (!payload) {
      setDocuments([]);
      setTotalDocuments(0);
      setActiveCount(0);
      setArchivedCount(0);
      return;
    }

    const docs = payload.documents.map((row) => ({
      id: String(row.id),
      name: row.document_name,
      createdAt: row.created_at,
      archived: Boolean(row.archived),
    }));

    setDocuments(docs);
    setTotalDocuments(payload.totalDocuments);
    setActiveCount(payload.activeCount);
    setArchivedCount(payload.archivedCount);
    setCurrentPage(payload.page);
  };

  useEffect(() => {
    loadDocuments(1, activeTab === 'archived');
  }, [activeTab]);

  const addDocument = async () => {
    if (!newDocName.trim()) return;

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newDocName.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to create document.');
      }

      setNewDocName('');
      await loadDocuments(1, activeTab === 'archived');
    } catch (error) {
      console.error('addDocument error:', error);
    }
  };

  const patchDocument = async (id: string, archived: boolean) => {
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, archived }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to update document.');
      }

      await loadDocuments(currentPage, activeTab === 'archived');
    } catch (error) {
      console.error('patchDocument error:', error);
    }
  };

  const archiveDocument = async (id: string) => {
    await patchDocument(id, true);
  };

  const restoreDocument = async (id: string) => {
    await patchDocument(id, false);
  };

  const handleTabChange = (tab: 'active' | 'archived') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const pageCount = Math.ceil(
    (activeTab === 'archived' ? archivedCount : activeCount) / PAGE_SIZE
  );
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < pageCount;

  const pageDocuments = documents;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-lg shadow-slate-200/50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
                Housekeeping Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Simple archive manager
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Add documents, archive manually, and let the system auto-archive any file older than five years.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Total Documents</p>
                <p className="mt-2 text-2xl font-semibold">{totalDocuments}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Active</p>
                <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Archived</p>
                <p className="mt-2 text-2xl font-semibold">{archivedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <section className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Add document
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Create a new file</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => handleTabChange('active')}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    activeTab === 'active'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => handleTabChange('archived')}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    activeTab === 'archived'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Archive
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Document name</span>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(event) => setNewDocName(event.target.value)}
                  placeholder="e.g. Year-end report"
                  className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-sky-200"
                />
              </label>
              <button
                onClick={addDocument}
                className="inline-flex items-center justify-center rounded-3xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add document
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Auto-archive rule</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Documents created more than five years ago are moved to the archive automatically when the page loads.
              </p>
            </div>

            <div className="space-y-4">
              {activeTab === 'active' ? (
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Active documents</h3>
                  {pageDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">No active documents yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {pageDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-950">{doc.name}</p>
                            <p className="text-sm text-slate-500">
                              Created {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => archiveDocument(doc.id)}
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Archive
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Archived documents</h3>
                  {pageDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">No archived documents yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {pageDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-950">{doc.name}</p>
                            <p className="text-sm text-slate-500">
                              Created {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => restoreDocument(doc.id)}
                            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>
                Page {currentPage} of {pageCount || 1}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!hasPreviousPage) return;
                    const nextPage = currentPage - 1;
                    setCurrentPage(nextPage);
                    loadDocuments(nextPage, activeTab === 'archived');
                  }}
                  disabled={!hasPreviousPage}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (!hasNextPage) return;
                    const nextPage = currentPage + 1;
                    setCurrentPage(nextPage);
                    loadDocuments(nextPage, activeTab === 'archived');
                  }}
                  disabled={!hasNextPage}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-6 rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/40">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Archive section</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Documents are grouped automatically based on archive status. Use this area to review archived files and restore them anytime.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700">Archive activity</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>• Auto-archiving runs on every page load.</p>
                <p>• Any document older than 5 years is archived automatically.</p>
                <p>• Manual archive and restore are available from the list.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
