'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';

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
  totalFiltered: number;
}

export default function HouseKeepingPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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

  type ArchiveScope = 'day' | 'month' | 'year' | 'decade';

  // MODAL STATES
  const [showArchiveDateModal, setShowArchiveDateModal] = useState(false);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>('day');
  const [archiveDate, setArchiveDate] = useState('');
  const [archiveConfirmStep, setArchiveConfirmStep] = useState<0 | 1 | 2>(0);
  const [archiveDocsToArchive, setArchiveDocsToArchive] = useState<string[]>([]);
  const [archiveModalMessage, setArchiveModalMessage] = useState('');
  const [isPreparingArchive, setIsPreparingArchive] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const [showRestoreDateModal, setShowRestoreDateModal] = useState(false);
  const [restoreScope, setRestoreScope] = useState<ArchiveScope>('month');
  const [restoreDate, setRestoreDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [restoreConfirmStep, setRestoreConfirmStep] = useState<0 | 1 | 2>(0);
  const [restoreDocsToRestore, setRestoreDocsToRestore] = useState<string[]>([]);
  const [restoreModalMessage, setRestoreModalMessage] = useState('');
  const [isPreparingRestore, setIsPreparingRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // PROGRESS STATES
  const [archiveProgress, setArchiveProgress] = useState(0);
  const [archiveProgressText, setArchiveProgressText] = useState('');
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreProgressText, setRestoreProgressText] = useState('');

  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('newest');
  const [darkMode, setDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  const theme = {
    page: darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900',
    card: darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-sky-200 text-slate-900',
    secondaryCard: darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-sky-50 border-sky-200 text-slate-900',
    input: darkMode ? 'bg-slate-950 text-slate-100 border-slate-800 placeholder-slate-400' : 'bg-slate-50 text-slate-900 border-slate-300 placeholder-slate-500',
    button: darkMode ? 'bg-slate-950 text-slate-100 border-slate-800 hover:bg-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
    pill: darkMode ? 'bg-black border-slate-800 text-slate-100' : 'bg-slate-200 border-slate-300 text-slate-700',
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchDocuments = async (
  page: number,
  archived: boolean,
  search = '',
  dateFilter = '',
  sort = 'newest',
  limit = 10
): Promise<DocumentsResponse | null> => {
  try {
    const response = await fetch(
      `/api/documents?page=${page}&archived=${archived ? 1 : 0}&search=${encodeURIComponent(search)}&date=${encodeURIComponent(dateFilter)}&sort=${sort}&limit=${limit}`
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

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const documentPageSize = 10;

  const loadDocuments = useCallback(async (
    page = 1,
    archived = activeTab === 'archived',
    sort = sortOrder,
    append = false
  ) => {
    setIsLoading(true);
    setIsSlowLoading(false);
    const slowTimer = window.setTimeout(() => setIsSlowLoading(true), 700);
    const minLoadTime = 400;
    const requestStart = performance.now();

    try {
      const payload = await fetchDocuments(
        page,
        archived,
        searchTerm,
        appliedDateFilter,
        sort,
        documentPageSize
      );

      const elapsed = performance.now() - requestStart;
      if (elapsed < minLoadTime) {
        await pause(minLoadTime - elapsed);
      }

      if (!payload) {
        if (!append) setDocuments([]);
        setTotalDocuments(0);
        setActiveCount(0);
        setArchivedCount(0);
        setTotalFiltered(0);
        setHasMore(false);
        return;
      }

      const docs = payload.documents.map((row) => ({
        id: String(row.id),
        name: row.tracking_code,
        createdAt: row.created_at,
        archived: Boolean(row.archived),
        archivedAt: row.archived_at,
      }));

      setDocuments((prev) => (append ? [...prev, ...docs] : docs));
      setTotalDocuments(payload.totalDocuments);
      setActiveCount(payload.activeCount);
      setArchivedCount(payload.archivedCount);
      setCurrentPage(payload.page);
      setTotalFiltered(payload.totalFiltered || docs.length);
      setHasMore(payload.page < (payload.totalPages || 1));
    } finally {
      clearTimeout(slowTimer);
      setIsSlowLoading(false);
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [activeTab, searchTerm, appliedDateFilter, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
    setDocuments([]);
    setHasMore(true);
    setTotalFiltered(0);
    setIsInitialLoad(true);
    loadDocuments(1, activeTab === 'archived', sortOrder, false);
  }, [searchTerm, activeTab, appliedDateFilter, sortOrder, loadDocuments]);

  useEffect(() => {
    const anchor = loadMoreRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !isLoading && hasMore) {
          loadDocuments(currentPage + 1, activeTab === 'archived', sortOrder, true);
        }
      },
      {
        rootMargin: '200px',
      }
    );

    observer.observe(anchor);

    return () => observer.disconnect();
  }, [currentPage, activeTab, sortOrder, isLoading, hasMore, loadDocuments]);

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

  const bulkPatchDocuments = async (
    documentIds: string[],
    archived: boolean,
    onProgress?: (processed: number, total: number) => void
  ): Promise<boolean> => {
    const batchSize = 100;
    let processed = 0;

    try {
      for (let i = 0; i < documentIds.length; i += batchSize) {
        const batch = documentIds.slice(i, i + batchSize);

        const response = await fetch('/api/documents', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: batch, archived }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message ?? 'Failed to update documents.');
        }

        processed += batch.length;
        onProgress?.(processed, documentIds.length);
      }

      return true;
    } catch (error) {
      console.error('bulkPatchDocuments error:', error);
      return false;
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

    const success = await bulkPatchDocuments(selectedArchivedDocs, false);
    if (!success) return;

    const restoredCount = selectedArchivedDocs.length;
    setSelectedArchivedDocs([]);
    await loadDocuments(currentPage, true);
    setSuccessMessage(`${restoredCount} Documents Restored`);
    setTimeout(() => setSuccessMessage(''), 3000); // Hide after 3 seconds
  };

  const normalizeRestoreValue = () => {
    if (!restoreDate) return '';
    if (restoreScope === 'decade') {
      return restoreDate;
    }

    return restoreDate;
  };

  const prepareRestoreAllByDate = async () => {
    const normalizedValue = normalizeRestoreValue();
    if (!normalizedValue) {
      setRestoreModalMessage('Please choose a valid ' + getArchiveDisplayLabel() + '.');
      return;
    }

    setRestoreModalMessage('');
    setIsPreparingRestore(true);

    try {
      const response = await fetch(
        `/api/documents?page=1&archived=1&limit=all&filterType=${restoreScope}&filterValue=${encodeURIComponent(normalizedValue)}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to fetch archived documents for restore.');
      }

      const docsToRestore = payload.documents;

      if (!docsToRestore || docsToRestore.length === 0) {
        setRestoreModalMessage(`No archived documents found for the selected ${getArchiveDisplayLabel()}.`);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRestoreDocsToRestore(docsToRestore.map((doc: any) => String(doc.id)));
      setRestoreConfirmStep(1);
    } catch (error) {
      console.error('prepareRestoreAllByDate error:', error);
      setRestoreModalMessage('Failed to load documents. Please try again.');
    } finally {
      setIsPreparingRestore(false);
    }
  };

  const restoreAllByDate = async () => {
    if (restoreDocsToRestore.length === 0) return;

    setIsRestoring(true);
    setRestoreProgress(0);
    setRestoreProgressText(`Restoring 0 of ${restoreDocsToRestore.length} documents...`);

    try {
      const success = await bulkPatchDocuments(
        restoreDocsToRestore,
        false,
        (processed, total) => {
          const percentage = Math.round((processed / total) * 100);
          setRestoreProgress(percentage);
          setRestoreProgressText(`Restoring ${processed} of ${total} documents...`);
        }
      );

      if (!success) {
        setRestoreModalMessage('Failed to restore documents. Please try again.');
        return;
      }

      setRestoreProgress(100);
      setRestoreProgressText(`Completed restoring ${restoreDocsToRestore.length} documents`);

      resetRestoreModal();
      setSelectedArchivedDocs([]);
      await loadDocuments(currentPage, true);
      setSuccessMessage(`${restoreDocsToRestore.length} Documents Restored`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('restoreAllByDate error:', error);
      setRestoreModalMessage('Failed to restore documents. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const resetRestoreModal = () => {
    setShowRestoreDateModal(false);
    setRestoreScope('month');
    const today = new Date();
    setRestoreDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    setRestoreConfirmStep(0);
    setRestoreDocsToRestore([]);
    setRestoreModalMessage('');
    setRestoreProgress(0);
    setRestoreProgressText('');
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

  const resetArchiveModal = () => {
    setShowArchiveDateModal(false);
    setArchiveScope('day');
    setArchiveDate('');
    setArchiveConfirmStep(0);
    setArchiveDocsToArchive([]);
    setArchiveModalMessage('');
    setArchiveProgress(0);
    setArchiveProgressText('');
  };

  const getArchiveDisplayLabel = () => {
    switch (archiveScope) {
      case 'day':
        return 'day';
      case 'month':
        return 'month';
      case 'year':
        return 'year';
      case 'decade':
        return 'decade';
      default:
        return 'day';
    }
  };

  const getDateInput = (
    scope: ArchiveScope,
    currentDate: string,
    setDate: (value: string) => void
  ) => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 30 }, (_, idx) => String(currentYear - idx));
    const decades = Array.from({ length: 10 }, (_, idx) => {
      const start = Math.floor((currentYear - idx * 10) / 10) * 10;
      return `${start}-${start + 9}`;
    });

    switch (scope) {
      case 'month':
        return (
          <label className="block">
            <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Month</span>
            <input
              type="month"
              value={currentDate}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
            />
          </label>
        );
      case 'year':
        return (
          <label className="block">
            <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Year</span>
            <select
              value={currentDate}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
            >
              <option value="">Select year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        );
      case 'decade':
        return (
          <label className="block">
            <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Decade</span>
            <select
              value={currentDate}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
            >
              <option value="">Select decade</option>
              {decades.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}
                </option>
              ))}
            </select>
          </label>
        );
      default:
        return (
          <label className="block">
            <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Date</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
            />
          </label>
        );
    }
  };

  const normalizeArchiveValue = () => {
    if (!archiveDate) return '';
    if (archiveScope === 'decade') {
      return archiveDate;
    }

    return archiveDate;
  };

  const prepareArchiveAllByDate = async () => {
    const normalizedValue = normalizeArchiveValue();
    if (!normalizedValue) {
      setArchiveModalMessage('Please choose a valid ' + getArchiveDisplayLabel() + '.');
      return;
    }

    setArchiveModalMessage('');
    setIsPreparingArchive(true);

    try {
      const response = await fetch(
        `/api/documents?page=1&archived=0&limit=all&filterType=${archiveScope}&filterValue=${encodeURIComponent(normalizedValue)}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to fetch documents for archiving.');
      }

      const docsToArchive = payload.documents;

      if (!docsToArchive || docsToArchive.length === 0) {
        setArchiveModalMessage(`No documents found for the selected ${getArchiveDisplayLabel()}.`);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setArchiveDocsToArchive(docsToArchive.map((doc: any) => String(doc.id)));
      setArchiveConfirmStep(1);
    } catch (error) {
      console.error('prepareArchiveAllByDate error:', error);
      setArchiveModalMessage('Failed to load documents. Please try again.');
    } finally {
      setIsPreparingArchive(false);
    }
  };

  const archiveAllByDate = async () => {
    if (archiveDocsToArchive.length === 0) return;

    setIsArchiving(true);
    setArchiveProgress(0);
    setArchiveProgressText(`Archiving 0 of ${archiveDocsToArchive.length} documents...`);

    try {
      const success = await bulkPatchDocuments(
        archiveDocsToArchive,
        true,
        (processed, total) => {
          const percentage = Math.round((processed / total) * 100);
          setArchiveProgress(percentage);
          setArchiveProgressText(`Archiving ${processed} of ${total} documents...`);
        }
      );

      if (!success) {
        setArchiveModalMessage('Failed to archive documents. Please try again.');
        return;
      }

      setArchiveProgress(100);
      setArchiveProgressText(`Completed archiving ${archiveDocsToArchive.length} documents`);

      resetArchiveModal();
      setSelectedDocs([]);
      await loadDocuments(currentPage, false);
      setSuccessMessage(`${archiveDocsToArchive.length} Documents Archived`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('archiveAllByDate error:', error);
      setArchiveModalMessage('Failed to archive documents. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleTabChange = (tab: 'active' | 'archived') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedDocs([]);
    setSelectedArchivedDocs([]);
    setSearchTerm('');
  };

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

  const filteredDocuments = useMemo(() => {
    if (activeTab !== 'active') return pageDocuments;

    return pageDocuments;
  }, [pageDocuments, activeTab]);

  const documentSkeletons = Array.from({ length: 5 }, (_, index) => (
    <div
      key={index}
      className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-100 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between animate-pulse"
    >
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-slate-300" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded bg-slate-300" />
          <div className="h-3 w-28 rounded bg-slate-200" />
        </div>
      </div>
      <div className="h-10 w-24 rounded-full bg-slate-300" />
    </div>
  ));

  const applyDateFilter = () => {
    setAppliedDateFilter(selectedDate);
  };

  const resetDateFilter = () => {
    setSelectedDate('');
    setAppliedDateFilter('');
    setSearchTerm('');
  };

  return (
    <div className={`min-h-screen ${theme.page}`}>
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-green-500 px-4 py-2 text-white shadow-lg">
          {successMessage}
        </div>
      )}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className={`mb-8 rounded-3xl p-8 shadow-lg shadow-slate-200/50 ${theme.card}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-400">
                Housekeeping Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Simple archive manager
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6">
                Add documents and archive them manually as needed.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-600'}`}>
                  {darkMode ? 'Night mode on' : 'Night mode off'}
                </span>
                <button
                  onClick={() => setDarkMode((prev) => !prev)}
                  className={`relative inline-flex h-9 w-20 items-center rounded-full border px-1 transition ${theme.pill}`}
                  aria-label="Toggle night mode"
                >
                  <span
                    className={`inline-block h-7 w-7 rounded-full bg-white shadow-sm transition-transform ${darkMode ? 'translate-x-10' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
              <div className={`rounded-3xl p-4 shadow-sm ring-1 ${darkMode ? 'bg-slate-950 ring-slate-800 text-slate-100' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Total Documents</p>
                <p className="mt-2 text-2xl font-semibold">{totalDocuments}</p>
              </div>

              <div className={`rounded-3xl p-4 shadow-sm ring-1 ${darkMode ? 'bg-slate-950 ring-slate-800 text-slate-100' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Active</p>
                <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
              </div>

              <div className={`rounded-3xl p-4 shadow-sm ring-1 ${darkMode ? 'bg-slate-950 ring-slate-800 text-slate-100' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Archived</p>
                <p className="mt-2 text-2xl font-semibold">{archivedCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <section className={`space-y-6 rounded-3xl p-6 shadow-lg shadow-slate-200/40 ${theme.card}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                  Add document
                </p>
                <h2 className={`mt-2 text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-950'}`}>
                  Create a new file
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => handleTabChange('active')}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    activeTab === 'active'
                      ? 'bg-slate-900 text-white'
                      : `${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`
                  }`}
                >
                  Active
                </button>

                <button
                  onClick={() => handleTabChange('archived')}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                    activeTab === 'archived'
                      ? 'bg-slate-900 text-white'
                      : `${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`
                  }`}
                >
                  Archive
                </button>
              </div>
            </div>

            {activeTab === 'active' && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tracking code..."
                  className={`w-72 rounded-full px-4 py-2 text-sm border ${theme.input}`}
                />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`rounded-full px-4 py-2 text-sm border ${theme.input}`}
                />

                <button
                  onClick={applyDateFilter}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                >
                  Filter
                </button>

                <button
                  onClick={resetDateFilter}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
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
                  onClick={() => {
                    resetArchiveModal();
                    setShowArchiveDateModal(true);
                  }}
                  className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Archive Many
                </button>
              </div>
            )}

            <div className="space-y-4">
              {activeTab === 'active' ? (
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    Active documents
                  </h3>
                  {isSlowLoading && (
                    <p className="mt-2 text-sm text-amber-700">
                      Still loading documents… this may take a moment.
                    </p>
                  )}

                  {isInitialLoad && isLoading ? (
                    <div className="space-y-3">
                      {documentSkeletons}
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <p className={`mt-3 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      No active documents found.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-sky-500 bg-sky-100 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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
                              <p className={`text-sm ${darkMode ? 'text-slate-800' : 'text-slate-800'}`}>
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        Archived documents
                      </h3>
                      <p className={`mt-1 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                        Search archived documents by tracking code and restore specific entries.
                      </p>
                      {isSlowLoading && (
                        <p className="mt-2 text-sm text-amber-700">
                          Still loading archived documents… thank you for waiting.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search archived documents..."
                        className={`w-72 rounded-full px-4 py-2 text-sm border ${theme.input}`}
                      />
                      <button
                        onClick={() => {
                          resetRestoreModal();
                          setShowRestoreDateModal(true);
                        }}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Restore Many
                      </button>
                    </div>
                  </div>

                  {pageDocuments.length > 0 && (
                    <div className="mt-4 mb-4 flex flex-wrap gap-2">
                      <button
                        onClick={selectAllArchivedCurrentPage}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'}`}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedArchivedDocs([])}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'}`}
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
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${darkMode ? 'border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'}`}
                      >
                        {sortOrder === 'oldest' ? 'Oldest First' : 'Newest First'}
                      </button>
                    </div>
                  )}

                  {isInitialLoad && isLoading ? (
                    <div className="space-y-3">
                      {documentSkeletons}
                    </div>
                  ) : pageDocuments.length === 0 ? (
                    <p className={`mt-3 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      No archived documents yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sortedArchivedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-3xl border border-sky-400 bg-sky-100 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
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

<div className={`space-y-1 text-sm ${darkMode ? 'text-slate-700' : 'text-slate-700'}`}>
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
                            className="inline-flex items-center justify-center rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                      {isLoading && !isInitialLoad && (
                        <div className="space-y-3">
                          {documentSkeletons.slice(0, 2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={`mt-6 rounded-3xl px-4 py-3 text-sm ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <span>
                Showing {documents.length} of {totalFiltered || totalDocuments} documents
              </span>
            </div>

            <div ref={loadMoreRef} className={`mt-4 rounded-3xl px-4 py-6 text-center text-sm ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              {isLoading && !isInitialLoad
                ? 'Loading more documents...'
                : hasMore
                ? 'Scroll to load more documents'
                : 'No more documents to load'}
            </div>
          </section>

          <aside className={`space-y-6 rounded-3xl p-6 shadow-lg shadow-slate-200/40 ${theme.card}`}>
            <div className={`rounded-3xl p-5 ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
              <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                Archive section
              </p>
              <p className={`mt-3 text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Documents are grouped automatically based on archive status. Any document routes too old will be archived automatically.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {showArchiveDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${theme.card}`}>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              Archive Documents
            </h3>

            <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Choose how you want to archive documents and enter the matching date range.
            </p>

            {archiveModalMessage && (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {archiveModalMessage}
              </div>
            )}

            {archiveConfirmStep === 0 && (
              <>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Archive by</span>
                    <select
                      value={archiveScope}
                      onChange={(e) => {
                        setArchiveScope(e.target.value as ArchiveScope);
                        setArchiveDate('');
                        setArchiveModalMessage('');
                      }}
                      className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
                    >
                      <option value="day">Days</option>
                      <option value="month">Months</option>
                      <option value="year">Years</option>
                      <option value="decade">Decades</option>
                    </select>
                  </label>

                  <div>{getDateInput(archiveScope, archiveDate, setArchiveDate)}</div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={resetArchiveModal}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={prepareArchiveAllByDate}
                    disabled={isPreparingArchive}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreparingArchive ? (
                      <>
                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Preparing...
                      </>
                    ) : (
                      'Prepare Archive'
                    )}
                  </button>
                </div>
              </>
            )}

            {archiveConfirmStep === 1 && (
              <>
                <div className={`mt-4 rounded-2xl p-4 text-sm ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <p className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {archiveDocsToArchive.length} documents found for {archiveDate}
                  </p>
                  <p className="mt-2">
                    This is the first confirmation. The next step will ask you to confirm once more before archiving.
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setArchiveConfirmStep(0)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                  >
                    Back
                  </button>

                  <button
                    onClick={() => setArchiveConfirmStep(2)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {archiveConfirmStep === 2 && (
              <>
                <div className={`mt-4 rounded-2xl p-4 text-sm ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <p className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    Confirm archive of {archiveDocsToArchive.length} documents created on {archiveDate}
                  </p>
                  <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    This action cannot be undone. All selected documents will be archived.
                  </p>
                </div>

                {isArchiving && (
                  <div className="mt-6">
                    <div className={`mb-2 text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {archiveProgressText}
                    </div>
                    <div className={`h-2 w-full rounded-full ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-all duration-300 ease-out"
                        style={{ width: `${archiveProgress}%` }}
                      />
                    </div>
                    <div className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {archiveProgress}% complete
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setArchiveConfirmStep(1)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                  >
                    Back
                  </button>

                  <button
                    onClick={archiveAllByDate}
                    disabled={isArchiving}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isArchiving ? (
                      <>
                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Archiving...
                      </>
                    ) : (
                      'Archive Now'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showRestoreDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl ${theme.card}`}>
            <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              Restore Documents
            </h3>

            <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Choose how you want to restore archived documents and enter the matching date range.
            </p>

            {restoreModalMessage && (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {restoreModalMessage}
              </div>
            )}

            {restoreConfirmStep === 0 && (
              <>
                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-700'}`}>Restore by</span>
                    <select
                      value={restoreScope}
                      onChange={(e) => {
                        setRestoreScope(e.target.value as ArchiveScope);
                        setRestoreDate('');
                        setRestoreModalMessage('');
                      }}
                      className={`mt-2 w-full rounded-2xl px-4 py-3 text-sm ${theme.input}`}
                    >
                      <option value="month">Months</option>
                      <option value="year">Years</option>
                    </select>
                  </label>

                  <div>{getDateInput(restoreScope, restoreDate, setRestoreDate)}</div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={resetRestoreModal}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={prepareRestoreAllByDate}
                    disabled={isPreparingRestore}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isPreparingRestore ? 'Loading...' : 'Continue'}
                  </button>
                </div>
              </>
            )}

            {restoreConfirmStep === 1 && (
              <>
                <div className={`mt-4 rounded-2xl p-4 text-sm ${darkMode ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                  <p className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    Confirm restore of {restoreDocsToRestore.length} documents matching {restoreDate}
                  </p>
                  <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    This action cannot be undone. All selected archived documents will be restored.
                  </p>
                </div>

                {isRestoring && (
                  <div className="mt-6">
                    <div className={`mb-2 text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {restoreProgressText}
                    </div>
                    <div className={`h-2 w-full rounded-full ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-all duration-300 ease-out"
                        style={{ width: `${restoreProgress}%` }}
                      />
                    </div>
                    <div className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {restoreProgress}% complete
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setRestoreConfirmStep(0)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold border ${theme.button}`}
                  >
                    Back
                  </button>
                  <button
                    onClick={restoreAllByDate}
                    disabled={isRestoring}
                    className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRestoring ? (
                      <>
                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Restoring...
                      </>
                    ) : (
                      'Restore Now'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={scrollToTop}
        className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}
