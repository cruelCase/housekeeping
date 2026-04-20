import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'newdts',
  port: 3306,
};

const dbConfigArchive = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'uniquearchdoc',
  port: 3306,
};

/* =========================
   CONNECTION HELPERS
========================= */
async function getConnection() {
  return mysql.createConnection(dbConfig);
}

async function getConnectionArchive() {
  const tempConfig = { ...dbConfigArchive } as any;
  delete tempConfig.database;

  const tempConnection = await mysql.createConnection(tempConfig);
  await tempConnection.execute('CREATE DATABASE IF NOT EXISTS uniquearchdoc');
  await tempConnection.end();

  return mysql.createConnection(dbConfigArchive);
}

/* =========================
   DB1 SCHEMA
========================= */
async function ensureDocumentSchema(connection: mysql.Connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS dts_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tracking_code VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL,
      archived TINYINT(1) NOT NULL DEFAULT 0,
      archived_at DATETIME NULL
    )
  `);
}

/* =========================
   ARCHIVE DOCUMENT SCHEMA
========================= */
async function ensureArchivedDocumentSchema(connection: mysql.Connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS archived_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      original_id INT NOT NULL,
      tracking_code VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL,
      archived TINYINT(1) NOT NULL DEFAULT 1,
      archived_at DATETIME NULL
    )
  `);
}

/* =========================
   ARCHIVE ROUTE SCHEMA
========================= */
async function ensureArchivedRoutesSchema(connection: mysql.Connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS archived_doc_routes (
      id INT AUTO_INCREMENT PRIMARY KEY,

      dts_route_original_id INT NOT NULL,
      dts_document_id INT NOT NULL,

      previous_route_id INT NULL,
      from_user_id INT NULL,
      from_section_id INT NULL,
      for_section_id INT NULL,
      for_user_id INT NULL,
      receiver_user_id INT NULL,

      route_purpose TEXT,
      accepting_remarks TEXT,
      actions_taken TEXT,

      actedby_user_id INT NULL,

      date_forwarded DATETIME NULL,
      date_accepted DATETIME NULL,
      date_acted DATETIME NULL,

      io_type VARCHAR(50),
      fwd_io_type VARCHAR(50),

      status_id INT NULL,

      deferred_reason TEXT,
      deferred_date DATETIME NULL,
      defer_until DATETIME NULL,

      out_released_to VARCHAR(255),
      logbook_page VARCHAR(100),

      del_reason TEXT,
      end_remarks TEXT,

      autoaction_date DATETIME NULL,
      date_parked DATETIME NULL,

      oldstatus INT NULL,
      active TINYINT(1),

      route_accomplished TINYINT(1),

      batch_release_id INT NULL,

      is_qr_accept TINYINT(1),
      for_archived TINYINT(1),

      created_at DATETIME,
      updated_at DATETIME,
      deleted_at DATETIME,

      dts_route_archived_at DATETIME NOT NULL
    )
  `);
}

/* =========================
   ARCHIVE ROUTES
========================= */
async function archiveRoutes(
  sourceConn: mysql.Connection,
  archiveConn: mysql.Connection,
  documentId: number
) {
  await ensureArchivedRoutesSchema(archiveConn);

  const [rows] = await sourceConn.execute(
    'SELECT * FROM dts_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );

  const routes = rows as any[];

  for (const route of routes) {
    await archiveConn.execute(
      `INSERT INTO archived_doc_routes (
        dts_route_original_id,
        dts_document_id,
        previous_route_id,
        from_user_id,
        from_section_id,
        for_section_id,
        for_user_id,
        receiver_user_id,
        route_purpose,
        accepting_remarks,
        actions_taken,
        actedby_user_id,
        date_forwarded,
        date_accepted,
        date_acted,
        io_type,
        fwd_io_type,
        status_id,
        deferred_reason,
        deferred_date,
        defer_until,
        out_released_to,
        logbook_page,
        del_reason,
        end_remarks,
        autoaction_date,
        date_parked,
        oldstatus,
        active,
        route_accomplished,
        batch_release_id,
        is_qr_accept,
        for_archived,
        created_at,
        updated_at,
        deleted_at,
        dts_route_archived_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()
      )`,
      [
        route.id,
        route.dts_document_id,
        route.previous_route_id,
        route.from_user_id,
        route.from_section_id,
        route.for_section_id,
        route.for_user_id,
        route.receiver_user_id,
        route.route_purpose,
        route.accepting_remarks,
        route.actions_taken,
        route.actedby_user_id,
        route.date_forwarded,
        route.date_accepted,
        route.date_acted,
        route.io_type,
        route.fwd_io_type,
        route.status_id,
        route.deferred_reason,
        route.deferred_date,
        route.defer_until,
        route.out_released_to,
        route.logbook_page,
        route.del_reason,
        route.end_remarks,
        route.autoaction_date,
        route.date_parked,
        route.oldstatus,
        route.active,
        route.route_accomplished,
        route.batch_release_id,
        route.is_qr_accept,
        route.for_archived,
        route.created_at,
        route.updated_at,
        route.deleted_at
      ]
    );
  }
}

/* =========================
   RESTORE ROUTES (OPTION A)
========================= */
async function restoreRoutes(
  archiveConn: mysql.Connection,
  sourceConn: mysql.Connection,
  documentId: number
) {
  const [rows] = await archiveConn.execute(
    'SELECT * FROM archived_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );

  const routes = rows as any[];

  for (const route of routes) {
    await sourceConn.execute(
      `INSERT INTO dts_doc_routes (
        dts_document_id,
        previous_route_id,
        from_user_id,
        from_section_id,
        for_section_id,
        for_user_id,
        receiver_user_id,
        route_purpose,
        accepting_remarks,
        actions_taken,
        actedby_user_id,
        date_forwarded,
        date_accepted,
        date_acted,
        io_type,
        fwd_io_type,
        status_id,
        deferred_reason,
        deferred_date,
        defer_until,
        out_released_to,
        logbook_page,
        del_reason,
        end_remarks,
        autoaction_date,
        date_parked,
        oldstatus,
        active,
        route_accomplished,
        batch_release_id,
        is_qr_accept,
        for_archived,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        route.dts_document_id,
        route.previous_route_id,
        route.from_user_id,
        route.from_section_id,
        route.for_section_id,
        route.for_user_id,
        route.receiver_user_id,
        route.route_purpose,
        route.accepting_remarks,
        route.actions_taken,
        route.actedby_user_id,
        route.date_forwarded,
        route.date_accepted,
        route.date_acted,
        route.io_type,
        route.fwd_io_type,
        route.status_id,
        route.deferred_reason,
        route.deferred_date,
        route.defer_until,
        route.out_released_to,
        route.logbook_page,
        route.del_reason,
        route.end_remarks,
        route.autoaction_date,
        route.date_parked,
        route.oldstatus,
        route.active,
        route.route_accomplished,
        route.batch_release_id,
        route.is_qr_accept,
        route.for_archived,
        route.created_at,
        route.updated_at,
        route.deleted_at
      ]
    );
  }

  await archiveConn.execute(
    'DELETE FROM archived_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );
}

/* =========================
   DELETE ROUTES
========================= */
async function deleteDocumentChildren(connection: mysql.Connection, documentId: number) {
  await connection.execute(
    'DELETE FROM dts_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );
}

/* =========================
   GET API (FIXED STATS)
========================= */
export async function GET(request: NextRequest) {
  let connection;
  let isArchivedQuery = false;

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1') || 1;
    const archivedParam = url.searchParams.get('archived');
    const search = String(url.searchParams.get('search') ?? '').trim();

    const limit = 10;
    const offset = (page - 1) * limit;

    if (archivedParam === '1') {
      connection = await getConnectionArchive();
      await ensureArchivedDocumentSchema(connection);
      isArchivedQuery = true;
    } else {
      connection = await getConnection();
      await ensureDocumentSchema(connection);
    }

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (!isArchivedQuery) {
      whereConditions.push('archived = 0');
    }

    if (search) {
      whereConditions.push(
        `(tracking_code LIKE ? OR DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?)`
      );
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const tableName = isArchivedQuery
      ? 'archived_documents'
      : 'dts_documents';

    const selectFields = isArchivedQuery
      ? 'original_id AS id, tracking_code, created_at, archived, archived_at'
      : '*';

    const [rows] = await connection.execute(
      `SELECT ${selectFields}
       FROM ${tableName}
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    /* =========================
       STATS FIXED
    ========================= */

    let totalDocuments = 0;
    let activeCount = 0;
    let archivedCount = 0;

    const activeConn = await getConnection();
    const [activeRows] = await activeConn.execute(
      'SELECT COUNT(*) AS activeCount FROM dts_documents WHERE archived = 0'
    );
    activeCount = (activeRows as any)[0]?.activeCount || 0;
    await activeConn.end();

    const archiveConn = await getConnectionArchive();
    const [archivedRows] = await archiveConn.execute(
      'SELECT COUNT(*) AS archivedCount FROM archived_documents'
    );
    archivedCount = (archivedRows as any)[0]?.archivedCount || 0;
    await archiveConn.end();

    totalDocuments = activeCount + archivedCount;

    const [filteredRows] = await connection.execute(
      `SELECT COUNT(*) AS totalFiltered FROM ${tableName} ${whereClause}`,
      params
    );

    const totalFiltered = (filteredRows as any)[0]?.totalFiltered || 0;

    return NextResponse.json({
      documents: rows,
      totalDocuments,
      activeCount,
      archivedCount,
      page,
      totalFiltered,
      totalPages: Math.ceil(totalFiltered / limit),
    });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { message: 'Failed to load documents.' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}

/* =========================
   POST
========================= */
export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();

    connection = await getConnection();
    await ensureDocumentSchema(connection);

    await connection.execute(
      `INSERT INTO dts_documents (tracking_code, created_at, archived)
       VALUES (?, NOW(), 0)`,
      [name]
    );

    return NextResponse.json({ success: true });

  } finally {
    if (connection) await connection.end();
  }
}

/* =========================
   PATCH (ARCHIVE / RESTORE)
========================= */
export async function PATCH(request: NextRequest) {
  let connection;
  let archiveConnection;

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const archived = Boolean(body?.archived);

    if (!id) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    /* ARCHIVE */
    if (archived) {
      connection = await getConnection();

      const [rows] = await connection.execute(
        'SELECT * FROM dts_documents WHERE id = ?',
        [id]
      );

      const doc = (rows as any)[0];

      archiveConnection = await getConnectionArchive();

      await archiveConnection.execute(
        `INSERT INTO archived_documents (
          original_id,
          tracking_code,
          created_at,
          archived,
          archived_at
        ) VALUES (?, ?, ?, 1, NOW())`,
        [doc.id, doc.tracking_code, doc.created_at]
      );

      await archiveRoutes(connection, archiveConnection, id);
      await deleteDocumentChildren(connection, id);

      await connection.execute(
        'DELETE FROM dts_documents WHERE id = ?',
        [id]
      );
    }

    /* RESTORE */
    else {
      archiveConnection = await getConnectionArchive();

      const [rows] = await archiveConnection.execute(
        'SELECT * FROM archived_documents WHERE original_id = ?',
        [id]
      );

      const doc = (rows as any)[0];

      connection = await getConnection();

      await connection.execute(
        `INSERT INTO dts_documents (
          id,
          tracking_code,
          created_at,
          archived,
          archived_at
        ) VALUES (?, ?, ?, 0, NULL)
        ON DUPLICATE KEY UPDATE archived = 0`,
        [doc.original_id, doc.tracking_code, doc.created_at]
      );

      await restoreRoutes(archiveConnection, connection, doc.original_id);

      await archiveConnection.execute(
        'DELETE FROM archived_documents WHERE original_id = ?',
        [id]
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json(
      { message: 'Failed to update document.' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
    if (archiveConnection) await archiveConnection.end();
  }
}
