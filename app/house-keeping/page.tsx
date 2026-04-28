'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';

interface Document {
  id: string;
  name: string;
  createdAt: string;
  archived: boolean;
  archivedAt: string | null;
}

interface DocumentRow {
  id: number;
  tracking_code: string;
  created_at: string;
  archived: number;
  archived_at: string | null;
}

interface DocumentsResponse {
  documents: DocumentRow[];
  totalDocuments: number;
  activeCount: number;
  archivedCount: number;
  page: number;
  totalPages: number;
}

export default function HouseKeepingPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [newDocName, setNewDocName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // FILTER STATES
  const [selectedDate, setSelectedDate] = useState('');
  const [appliedDateFilter, setAppliedDateFilter] = useState('');

  // REAL-TIME SEARCH
  const [searchTerm, setSearchTerm] = useState('');

  // MULTI SELECT
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedArchivedDocs, setSelectedArchivedDocs] = useState<string[]>([]);

  // SUCCESS MESSAGE
  const [successMessage, setSuccessMessage] = useState('');

  // MODAL STATES
  const [showArchiveDateModal, setShowArchiveDateModal] = useState(false);
  const [archiveDate, setArchiveDate] = useState('');

  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('newest');

  const fetchDocuments = async (
  page: number,
  archived: boolean,
  search = '',
  dateFilter = ''
): Promise<DocumentsResponse | null> => {
  try {
    const response = await fetch(
      `/api/documents?page=${page}&archived=${archived ? 1 : 0}&search=${encodeURIComponent(search)}&date=${encodeURIComponent(dateFilter)}`
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


  const loadDocuments = useCallback(async (
    page = 1,
    archived = activeTab === 'archived'
  ) => {
    const payload = await fetchDocuments(page, archived, searchTerm, appliedDateFilter);

    if (!payload) {
      setDocuments([]);
      setTotalDocuments(0);
      setActiveCount(0);
      setArchivedCount(0);
      return;
    }

    const docs = payload.documents.map((row) => ({
      id: String(row.id),
      name: row.tracking_code,
      createdAt: row.created_at,
      archived: Boolean(row.archived),
      archivedAt: row.archived_at,
    }));

    setDocuments(docs);
    setTotalDocuments(payload.totalDocuments);
    setActiveCount(payload.activeCount);
    setArchivedCount(payload.archivedCount);
    setTotalPages(payload.totalPages || 1);
    setCurrentPage(payload.page);
  }, [activeTab, searchTerm, appliedDateFilter]);

  useEffect(() => {
    setCurrentPage(1);
    loadDocuments(1, activeTab === 'archived');
  }, [searchTerm, activeTab, appliedDateFilter, loadDocuments]);

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

  const patchDocument = async (
    id: string,
    archived: boolean,
    reload = true
  ) => {
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

      if (reload) {
        await loadDocuments(currentPage, activeTab === 'archived');
      }
    } catch (error) {
      console.error('patchDocument error:', error);
    }
  };

  const archiveDocument = async (id: string) => {
    await patchDocument(id, true);
    setSuccessMessage('Document Archived');
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const restoreDocument = async (id: string) => {
    await patchDocument(id, false);
    setSuccessMessage('Document Restored');
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const restoreSelectedArchived = async () => {
    if (selectedArchivedDocs.length === 0) return;

    await Promise.all(
      selectedArchivedDocs.map((id) => patchDocument(id, false))
    );

    setSelectedArchivedDocs([]);
    await loadDocuments(currentPage, true);
    setSuccessMessage(`${selectedArchivedDocs.length} Documents Restored`);
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const selectAllArchivedCurrentPage = () => {
    setSelectedArchivedDocs((prev) => {
      const next = new Set(prev);
      pageDocuments.forEach((doc) => next.add(doc.id));
      return Array.from(next);
    });
  };

  const archiveSelectedDocuments = async () => {
    if (selectedDocs.length === 0) return;

    await Promise.all(
      selectedDocs.map((id) => patchDocument(id, true, false))
    );

    setSelectedDocs([]);
    await loadDocuments(currentPage, false);
    setSuccessMessage(`${selectedDocs.length} Documents Archived`);
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const archiveAllByDate = async () => {
    if (!archiveDate) return;

    const docsToArchive = documents.filter((doc) => {
      const date = new Date(doc.createdAt).toISOString().split('T')[0];
      return date === archiveDate;
    });

    if (docsToArchive.length === 0) {
      setShowArchiveDateModal(false);
      return;
    }

    await Promise.all(
      docsToArchive.map((doc) => patchDocument(doc.id, true, false))
    );

    setShowArchiveDateModal(false);
    setArchiveDate('');
    setSelectedDocs([]);
    await loadDocuments(currentPage, false);
    setSuccessMessage(`${docsToArchive.length} Documents Archived`);
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const handleTabChange = (tab: 'active' | 'archived') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedDocs([]);
    setSelectedArchivedDocs([]);
    setSearchTerm('');
  };

  const pageCount = totalPages;

  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < pageCount;

  const pageDocuments = documents;

  const sortedArchivedDocuments = useMemo(() => {
  if (activeTab !== 'archived') return pageDocuments;

  return [...pageDocuments].sort((a, b) => {
    const dateA = new Date(a.archivedAt || a.createdAt).getTime();
    const dateB = new Date(b.archivedAt || b.createdAt).getTime();

    return sortOrder === 'oldest'
      ? dateA - dateB
      : dateB - dateA;
  });
}, [pageDocuments, sortOrder, activeTab]);


  const getDocumentDate = (createdAt: string | Date) => {
    if (createdAt instanceof Date) {
      return createdAt.toISOString().split('T')[0];
    }

    return createdAt.split('T')[0].split(' ')[0];
  };

  const filteredDocuments = useMemo(() => {
    if (activeTab !== 'active') return pageDocuments;

    if (!appliedDateFilter) {
      return pageDocuments;
    }

    return pageDocuments.filter((doc) => {
      const documentDate = getDocumentDate(doc.createdAt);
      return documentDate === appliedDateFilter;
    });
  }, [pageDocuments, appliedDateFilter, activeTab]);

  const applyDateFilter = () => {
    setAppliedDateFilter(selectedDate);
  };

  const resetDateFilter = () => {
    setSelectedDate('');
    setAppliedDateFilter('');
    setSearchTerm('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-green-500 px-4 py-2 text-white shadow-lg">
          {successMessage}
        </div>
      )}
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
                Add documents and archive them manually as needed.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
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
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Create a new file
                </h2>
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
                <span className="text-sm font-medium text-slate-700">
                  Document name
                </span>
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

            {activeTab === 'active' && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tracking code..."
                  className="w-72 rounded-full border border-slate-300 px-4 py-2 text-sm"
                />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm"
                />

                <button
                  onClick={applyDateFilter}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                >
                  Filter
                </button>

                <button
                  onClick={resetDateFilter}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                >
                  Reset
                </button>

                <button
                  onClick={archiveSelectedDocuments}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Archive Selected
                </button>

                <button
                  onClick={() => setShowArchiveDateModal(true)}
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Archive All by Date
                </button>
              </div>
            )}

            <div className="space-y-4">
              {activeTab === 'active' ? (
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Active documents
                  </h3>

                  {filteredDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">
                      No active documents found.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedDocs.includes(doc.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDocs((prev) => [...prev, doc.id]);
                                } else {
                                  setSelectedDocs((prev) =>
                                    prev.filter((id) => id !== doc.id)
                                  );
                                }
                              }}
                            />

                            <div>
                              <p className="font-semibold text-slate-950">
                                {doc.name}
                              </p>
                              <p className="text-sm text-slate-500">
                                Created{' '}
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-950">
                      Archived documents
                    </h3>

                    {pageDocuments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={selectAllArchivedCurrentPage}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedArchivedDocs([])}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                        >
                          Deselect All
                        </button>
                        <button
                          onClick={restoreSelectedArchived}
                          disabled={selectedArchivedDocs.length === 0}
                          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Restore Selected ({selectedArchivedDocs.length})
                        </button>
                        <button
                            onClick={() =>
                              setSortOrder((prev) => (prev === 'oldest' ? 'newest' : 'oldest'))
                            }
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
                          >
                            {sortOrder === 'oldest' ? 'Oldest First' : 'Newest First'}
                          </button>

                      </div>
                    )}
                  </div>

                  {pageDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">
                      No archived documents yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sortedArchivedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedArchivedDocs.includes(doc.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedArchivedDocs((prev) => [...prev, doc.id]);
                                } else {
                                  setSelectedArchivedDocs((prev) =>
                                    prev.filter((id) => id !== doc.id)
                                  );
                                }
                              }}
                            />

                            <div>
                            <p className="font-semibold text-slate-950">
                              {doc.name}
                            </p>

                            <div className="space-y-1 text-sm text-slate-500">
                              <p>
                                Created{' '}
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </p>

                              {doc.archivedAt && (
                                <p className="font-medium text-amber-600">
                                  Archived{' '}
                                  {new Date(
                                    doc.archivedAt
                                  ).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Archive section
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Documents are grouped automatically based on archive status. Any document routes too old will be archived automatically.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {showArchiveDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-950">
              Archive Documents by Date
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Select a date to archive all active documents created on that date.
            </p>

            <input
              type="date"
              value={archiveDate}
              onChange={(e) => setArchiveDate(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveDateModal(false);
                  setArchiveDate('');
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={archiveAllByDate}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
