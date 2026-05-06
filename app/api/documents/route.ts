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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  await connection.execute(
    `ALTER TABLE dts_documents
     ADD COLUMN IF NOT EXISTS archived TINYINT(1) NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL`
  );
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
      mo_yr VARCHAR(50) NULL,
      issued_num VARCHAR(100) NULL,
      description TEXT NULL,
      guestdoc_id INT NULL,
      dts_doc_type_id INT NULL,
      tracking_issuedby_id INT NULL,
      fromuser_id INT NULL,
      from_section_id INT NULL,
      guest_origin_name VARCHAR(255) NULL,
      guest_origin_organization VARCHAR(255) NULL,
      logbook_page VARCHAR(100) NULL,
      datetime_first_accepted DATETIME NULL,
      actions_needed TEXT NULL,
      file_at VARCHAR(255) NULL,
      status_id INT NULL,
      old_track VARCHAR(255) NULL,
      is_active TINYINT(1) NULL,
      for_archived TINYINT(1) NULL,
      is_archived TINYINT(1) NULL,
      created_at DATETIME NULL,
      updated_at DATETIME NULL,
      deleted_at DATETIME NULL,
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
  `SELECT * FROM dts_doc_routes
   WHERE dts_document_id = ?
   ORDER BY id DESC`,
  [documentId]
);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // 1. Get routes in correct order (VERY IMPORTANT)
  const [rows] = await archiveConn.execute(
    `SELECT * FROM archived_doc_routes 
     WHERE dts_document_id = ?
     ORDER BY id ASC`,
    [documentId]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = rows as any[];

  if (routes.length === 0) {
    console.warn(`restoreRoutes: No archived routes found for dts_document_id=${documentId}`);
    return;
  }

  // 2. Create ID mapping (OLD → NEW)
  const idMap = new Map<number, number>();

  // 3. FIRST PASS: Insert WITHOUT previous_route_id
  for (const route of routes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result]: any = await sourceConn.execute(
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
        ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? 
      )`,
      [
        route.dts_document_id,
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

    // Save mapping: OLD ID → NEW ID
    idMap.set(route.dts_route_original_id, result.insertId);
  }

  // 4. SECOND PASS: Fix previous_route_id
      for (const route of routes) {
      if (route.previous_route_id) {

        const newPreviousId = idMap.get(route.previous_route_id);
        const currentNewId = idMap.get(route.dts_route_original_id);

        // SAFETY CHECK (VERY IMPORTANT)
      if (!newPreviousId || !currentNewId) {
          console.warn(
            `restoreRoutes: Could not remap previous_route_id=${route.previous_route_id} for route original_id=${route.dts_route_original_id}`
          );
          continue;
        }

        await sourceConn.execute(
          `UPDATE dts_doc_routes
          SET previous_route_id = ?
          WHERE id = ?`,
          [newPreviousId, currentNewId]
        );
      }
    }


  // 5. Delete from archive after restore
  await archiveConn.execute(
    'DELETE FROM archived_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );
}


/* =========================
   DELETE ROUTES
========================= */
async function deleteDocumentChildren(connection: mysql.Connection, documentId: number) {
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

  await connection.execute(
    'DELETE FROM dts_doc_routes WHERE dts_document_id = ?',
    [documentId]
  );

  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
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
    const dateFilter = String(url.searchParams.get('date') ?? '').trim();
    const sort = String(url.searchParams.get('sort') ?? 'newest');
    const limitParam = url.searchParams.get('limit');

    const orderDirection = sort === 'oldest' ? 'ASC' : 'DESC';

    const limit = limitParam === 'all' ? 10000 : 10; // Large limit for 'all'
    const offset = limitParam === 'all' ? 0 : (page - 1) * limit;

    if (archivedParam === '1') {
      connection = await getConnectionArchive();
      await ensureArchivedDocumentSchema(connection);
      isArchivedQuery = true;
    } else {
      connection = await getConnection();
      await ensureDocumentSchema(connection);
    }


    const whereConditions: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    if (dateFilter) {
      whereConditions.push('DATE(created_at) = ?');
      params.push(dateFilter);
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
      ORDER BY ${isArchivedQuery ? 'archived_at' : 'created_at'} ${orderDirection}
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeCount = (activeRows as any)[0]?.activeCount || 0;
    await activeConn.end();

    const archiveConn = await getConnectionArchive();
    const [archivedRows] = await archiveConn.execute(
      'SELECT COUNT(*) AS archivedCount FROM archived_documents'
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    archivedCount = (archivedRows as any)[0]?.archivedCount || 0;
    await archiveConn.end();

    totalDocuments = activeCount + archivedCount;

    const [filteredRows] = await connection.execute(
      `SELECT COUNT(*) AS totalFiltered FROM ${tableName} ${whereClause}`,
      params
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalFiltered = (filteredRows as any)[0]?.totalFiltered || 0;

    return NextResponse.json({
      documents: rows,
      totalDocuments,
      activeCount,
      archivedCount,
      page: limitParam === 'all' ? 1 : page,
      totalFiltered,
      totalPages: limitParam === 'all' ? 1 : Math.ceil(totalFiltered / limit),
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
   Safe delete handler
========================= */

async function safeDeleteDocument(documentId: number) {
  let connection;
  let archiveConnection;

  try {
    connection = await getConnection();
    archiveConnection = await getConnectionArchive();

    await ensureDocumentSchema(connection);
    await ensureArchivedDocumentSchema(archiveConnection);
    await ensureArchivedRoutesSchema(archiveConnection);

    // 1. Get document first
    const [docRows] = await connection.execute(
      'SELECT * FROM dts_documents WHERE id = ?',
      [documentId]
    );

    if (!Array.isArray(docRows) || docRows.length === 0) {
      throw new Error('Document not found');
    }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (docRows as any)[0];

    // 2. Archive document (if not already archived)
    await archiveConnection.execute(
        `INSERT INTO archived_documents (
          original_id,
          tracking_code,
          mo_yr,
          issued_num,
          description,
          guestdoc_id,
          dts_doc_type_id,
          tracking_issuedby_id,
          fromuser_id,
          from_section_id,
          guest_origin_name,
          guest_origin_organization,
          logbook_page,
          datetime_first_accepted,
          actions_needed,
          file_at,
          status_id,
          old_track,
          is_active,
          for_archived,
          is_archived,
          created_at,
          updated_at,
          deleted_at,
          archived,
          archived_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW()
        )`,
        [
          doc.id,
          doc.tracking_code,
          doc.mo_yr,
          doc.issued_num,
          doc.description,
          doc.guestdoc_id,
          doc.dts_doc_type_id,
          doc.tracking_issuedby_id,
          doc.fromuser_id,
          doc.from_section_id,
          doc.guest_origin_name,
          doc.guest_origin_organization,
          doc.logbook_page,
          doc.datetime_first_accepted,
          doc.actions_needed,
          doc.file_at,
          doc.status_id,
          doc.old_track,
          doc.is_active,
          doc.for_archived,
          doc.is_archived,
          doc.created_at,
          doc.updated_at,
          doc.deleted_at
        ]
      );


    // 3. Archive routes FIRST
    await archiveRoutes(connection, archiveConnection, documentId);

    // 4. Delete routes from DB1
    await deleteDocumentChildren(connection, documentId);

    // 5. NOW safe to delete document
    await connection.execute(
      'DELETE FROM dts_documents WHERE id = ?',
      [documentId]
    );

  } catch (error) {
    console.error('safeDeleteDocument error:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
    if (archiveConnection) await archiveConnection.end();
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

    connection = await getConnection();
    archiveConnection = await getConnectionArchive();

    await connection.beginTransaction();
    await archiveConnection.beginTransaction();

    /* =========================
       ARCHIVE
    ========================= */
    if (archived) {

      const [rows] = await connection.execute(
        'SELECT * FROM dts_documents WHERE id = ?',
        [id]
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (rows as any)[0];


      const [existing] = await archiveConnection.execute(
        'SELECT id FROM archived_documents WHERE original_id = ?',
        [id]
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((existing as any[]).length > 0) {
        throw new Error(`Document ${id} is already archived.`);
      }

      await archiveConnection.execute(
        `INSERT INTO archived_documents (
          original_id,
          tracking_code,
          mo_yr,
          issued_num,
          description,
          guestdoc_id,
          dts_doc_type_id,
          tracking_issuedby_id,
          fromuser_id,
          from_section_id,
          guest_origin_name,
          guest_origin_organization,
          logbook_page,
          datetime_first_accepted,
          actions_needed,
          file_at,
          status_id,
          old_track,
          is_active,
          for_archived,
          is_archived,
          created_at,
          updated_at,
          deleted_at,
          archived,
          archived_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW()
        )`,
        [
          doc.id,
          doc.tracking_code,
          doc.mo_yr,
          doc.issued_num,
          doc.description,
          doc.guestdoc_id,
          doc.dts_doc_type_id,
          doc.tracking_issuedby_id,
          doc.fromuser_id,
          doc.from_section_id,
          doc.guest_origin_name,
          doc.guest_origin_organization,
          doc.logbook_page,
          doc.datetime_first_accepted,
          doc.actions_needed,
          doc.file_at,
          doc.status_id,
          doc.old_track,
          doc.is_active,
          doc.for_archived,
          doc.is_archived,
          doc.created_at,
          doc.updated_at,
          doc.deleted_at
        ]
      );

      await archiveRoutes(connection, archiveConnection, id);
      await deleteDocumentChildren(connection, id);

      await connection.execute(
        'DELETE FROM dts_documents WHERE id = ?',
        [id]
      );
    }

    /* =========================
       RESTORE
    ========================= */
    else {

      const [rows] = await archiveConnection.execute(
        'SELECT * FROM archived_documents WHERE original_id = ?',
        [id]
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (rows as any)[0];

      await connection.execute(
        `INSERT INTO dts_documents (
          id,
          tracking_code,
          mo_yr,
          issued_num,
          description,
          guestdoc_id,
          dts_doc_type_id,
          tracking_issuedby_id,
          fromuser_id,
          from_section_id,
          guest_origin_name,
          guest_origin_organization,
          logbook_page,
          datetime_first_accepted,
          actions_needed,
          file_at,
          status_id,
          old_track,
          is_active,
          for_archived,
          is_archived,
          created_at,
          updated_at,
          deleted_at,
          archived,
          archived_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL
        )
        ON DUPLICATE KEY UPDATE
          tracking_code = VALUES(tracking_code),
          mo_yr = VALUES(mo_yr),
          issued_num = VALUES(issued_num),
          description = VALUES(description),
          guestdoc_id = VALUES(guestdoc_id),
          dts_doc_type_id = VALUES(dts_doc_type_id),
          tracking_issuedby_id = VALUES(tracking_issuedby_id),
          fromuser_id = VALUES(fromuser_id),
          from_section_id = VALUES(from_section_id),
          guest_origin_name = VALUES(guest_origin_name),
          guest_origin_organization = VALUES(guest_origin_organization),
          logbook_page = VALUES(logbook_page),
          datetime_first_accepted = VALUES(datetime_first_accepted),
          actions_needed = VALUES(actions_needed),
          file_at = VALUES(file_at),
          status_id = VALUES(status_id),
          old_track = VALUES(old_track),
          is_active = VALUES(is_active),
          for_archived = VALUES(for_archived),
          is_archived = VALUES(is_archived),
          updated_at = VALUES(updated_at),
          deleted_at = VALUES(deleted_at),
          archived = 0,
          archived_at = NULL
        `,
        [
          doc.original_id,
          doc.tracking_code,
          doc.mo_yr,
          doc.issued_num,
          doc.description,
          doc.guestdoc_id,
          doc.dts_doc_type_id,
          doc.tracking_issuedby_id,
          doc.fromuser_id,
          doc.from_section_id,
          doc.guest_origin_name,
          doc.guest_origin_organization,
          doc.logbook_page,
          doc.datetime_first_accepted,
          doc.actions_needed,
          doc.file_at,
          doc.status_id,
          doc.old_track,
          doc.is_active,
          doc.for_archived,
          doc.is_archived,
          doc.created_at,
          doc.updated_at,
          doc.deleted_at
        ]
      );
      // Restore routes
      await restoreRoutes(archiveConnection, connection, doc.original_id);

      // Delete from archive after restore
      await archiveConnection.execute(
        'DELETE FROM archived_documents WHERE original_id = ?',
        [id]
      );
    }

    await connection.commit();
    await archiveConnection.commit();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('PATCH error:', error);

    if (connection) await connection.rollback();
    if (archiveConnection) await archiveConnection.rollback();

    return NextResponse.json(
      { message: 'Failed to update document.' },
      { status: 500 }
    );

  } finally {
    if (connection) await connection.end();
    if (archiveConnection) await archiveConnection.end();
  }
}
