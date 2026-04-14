import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'newdts',
};

const dbConfigArchive = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'uniquearchdoc',
};

async function getConnection() {
  return mysql.createConnection(dbConfig);
}

async function getConnectionArchive() {
  // First, connect without database to create it if needed
  const tempConfig = { ...dbConfigArchive } as any;
  delete tempConfig.database;
  const tempConnection = await mysql.createConnection(tempConfig);
  await tempConnection.execute('CREATE DATABASE IF NOT EXISTS uniquearchdoc');
  await tempConnection.end();

  // Now connect to the database
  return mysql.createConnection(dbConfigArchive);
}

async function ensureDocumentSchema(connection: mysql.Connection) {
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dts_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tracking_code VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL,
        archived TINYINT(1) NOT NULL DEFAULT 0,
        archived_at DATETIME NULL
      )
    `);

    const [columns] = await connection.execute('SHOW COLUMNS FROM dts_documents');
    const existingColumns = new Set(
      (columns as Array<{ Field: string }>).map((column) => column.Field)
    );
    const alterClauses: string[] = [];

    if (!existingColumns.has('tracking_code')) {
      alterClauses.push('ADD COLUMN tracking_code VARCHAR(255) NOT NULL');
    }
    if (!existingColumns.has('created_at')) {
      alterClauses.push('ADD COLUMN created_at DATETIME NOT NULL');
    }
    if (!existingColumns.has('archived')) {
      alterClauses.push('ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!existingColumns.has('archived_at')) {
      alterClauses.push('ADD COLUMN archived_at DATETIME NULL');
    }

    if (alterClauses.length > 0) {
      await connection.execute(`ALTER TABLE dts_documents ${alterClauses.join(', ')}`);
    }
  } catch (error) {
    console.error('ensureDocumentSchema error:', error);
    throw error;
  }
}

async function ensureArchivedDocumentSchema(connection: mysql.Connection) {
  try {
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

    const [columns] = await connection.execute('SHOW COLUMNS FROM archived_documents');
    const existingColumns = new Set(
      (columns as Array<{ Field: string }>).map((column) => column.Field)
    );
    const alterClauses: string[] = [];

    if (!existingColumns.has('original_id')) {
      alterClauses.push('ADD COLUMN original_id INT NOT NULL');
    }
    if (!existingColumns.has('tracking_code')) {
      alterClauses.push('ADD COLUMN tracking_code VARCHAR(255) NOT NULL');
    }
    if (!existingColumns.has('created_at')) {
      alterClauses.push('ADD COLUMN created_at DATETIME NOT NULL');
    }
    if (!existingColumns.has('archived')) {
      alterClauses.push('ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 1');
    }
    if (!existingColumns.has('archived_at')) {
      alterClauses.push('ADD COLUMN archived_at DATETIME NULL');
    }

    if (alterClauses.length > 0) {
      await connection.execute(`ALTER TABLE archived_documents ${alterClauses.join(', ')}`);
    }
  } catch (error) {
    console.error('ensureArchivedDocumentSchema error:', error);
    throw error;
  }
}

async function deleteDocumentChildren(connection: mysql.Connection, documentId: number) {
  let fkDisabled = false;

  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    fkDisabled = true;

    await connection.execute(
      'DELETE FROM dts_doc_routes WHERE dts_document_id = ?',
      [documentId]
    );
  } catch (error) {
    // Ignore if the child table does not exist or deletion is not required.
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (!msg.includes('doesn\'t exist') && !msg.includes('does not exist')) {
        throw error;
      }
    }
  } finally {
    if (fkDisabled) {
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    }
  }
}

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

    // Build WHERE conditions
    const whereConditions: string[] = [];
    const params: Array<string | number> = [];

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
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // For counts, we need to query both databases
    let totalDocuments = 0;
    let activeCount = 0;
    let archivedCount = 0;

    // Query active from newdts
    const activeConn = await getConnection();
    const [activeRows] = await activeConn.execute(
      'SELECT COUNT(*) AS activeCount FROM dts_documents WHERE archived = 0'
    );
    const activeRowsTyped = activeRows as Array<{activeCount: number}>;
    activeCount = activeRowsTyped[0]?.activeCount || 0;
    await activeConn.end();

    // Query archived from uniquearchdoc
    const archiveConn = await getConnectionArchive();
    const [archivedRows] = await archiveConn.execute(
      'SELECT COUNT(*) AS archivedCount FROM archived_documents'
    );
    const archivedRowsTyped = archivedRows as Array<{archivedCount: number}>;
    archivedCount = archivedRowsTyped[0]?.archivedCount || 0;
    await archiveConn.end();

    totalDocuments = activeCount + archivedCount;

    // Count total documents matching the current filter/search
    const tableName = isArchivedQuery ? 'archived_documents' : 'dts_documents';
    const [filteredCountRows] = await connection.execute(
      `SELECT COUNT(*) AS totalFiltered
       FROM ${tableName}
       ${whereClause}`,
      params
    );

    const totalFiltered =
      Array.isArray(filteredCountRows) && filteredCountRows.length > 0
        ? (filteredCountRows[0] as {totalFiltered: number}).totalFiltered
        : 0;

    // Fetch paginated documents
    const selectFields = isArchivedQuery
      ? 'original_id AS id, tracking_code, created_at, archived, archived_at'
      : '*';
    const [rows] = await connection.execute(
      `SELECT ${selectFields} FROM ${tableName}
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      documents: rows,
      totalDocuments,
      activeCount,
      archivedCount,
      page,
      totalFiltered, // total number of documents matching search/filters
      totalPages: Math.ceil(totalFiltered / limit), // total pages for pagination
    });
  } catch (error) {
    console.error('GET /api/documents error:', error);
    return NextResponse.json(
      { message: 'Failed to load documents.' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();

    if (!name) {
      return NextResponse.json(
        { message: 'Document name is required.' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await ensureDocumentSchema(connection);

    const [result] = await connection.execute(
      'INSERT INTO dts_documents (tracking_code, created_at, archived) VALUES (?, NOW(), 0)',
      [name]
    );

    return NextResponse.json({ success: true, id: (result as mysql.ResultSetHeader).insertId });
  } catch (error) {
    console.error('POST /api/documents error:', error);
    return NextResponse.json(
      { message: 'Failed to create document.' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PATCH(request: NextRequest) {
  let connection;
  let archiveConnection;

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const rawArchived = body?.archived;
    const archived =
      rawArchived === true ||
      rawArchived === 'true' ||
      rawArchived === 1 ||
      rawArchived === '1';

    if (!id || (rawArchived !== true && rawArchived !== false && rawArchived !== 'true' && rawArchived !== 'false' && rawArchived !== 1 && rawArchived !== 0 && rawArchived !== '1' && rawArchived !== '0')) {
      return NextResponse.json(
        { message: 'Invalid request payload.' },
        { status: 400 }
      );
    }

    if (archived) {
      // Archiving: move from dts_documents to archived_documents
      connection = await getConnection();
      await ensureDocumentSchema(connection);

      const [rows] = await connection.execute(
        'SELECT * FROM dts_documents WHERE id = ?',
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { message: 'Document not found.' },
          { status: 404 }
        );
      }

      const doc = rows[0] as {
        id: number;
        tracking_code: string;
        created_at: Date;
        archived: number;
        archived_at: Date | null;
      };

      archiveConnection = await getConnectionArchive();
      await ensureArchivedDocumentSchema(archiveConnection);

      await archiveConnection.execute(
        'INSERT INTO archived_documents (original_id, tracking_code, created_at, archived, archived_at) VALUES (?, ?, ?, 1, NOW())',
        [doc.id, doc.tracking_code, doc.created_at]
      );

      await deleteDocumentChildren(connection, id);
      await connection.execute(
        'DELETE FROM dts_documents WHERE id = ?',
        [id]
      );
    } else {
      // Unarchiving: move from archived_documents to dts_documents
      archiveConnection = await getConnectionArchive();
      await ensureArchivedDocumentSchema(archiveConnection);

      const [rows] = await archiveConnection.execute(
        'SELECT * FROM archived_documents WHERE original_id = ?',
        [id]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json(
          { message: 'Archived document not found.' },
          { status: 404 }
        );
      }

      const doc = rows[0] as {
        id: number;
        original_id: number;
        tracking_code: string;
        created_at: Date;
        archived: number;
        archived_at: Date | null;
      };

      connection = await getConnection();
      await ensureDocumentSchema(connection);

      await connection.execute(
        `INSERT INTO dts_documents (id, tracking_code, created_at, archived, archived_at)
         VALUES (?, ?, ?, 0, NULL)
         ON DUPLICATE KEY UPDATE
           archived = 0,
           archived_at = NULL,
           created_at = VALUES(created_at)`,
        [doc.original_id, doc.tracking_code, doc.created_at]
      );

      await archiveConnection.execute(
        'DELETE FROM archived_documents WHERE original_id = ?',
        [id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/documents error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: `Failed to update document: ${message}` },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
    if (archiveConnection) {
      await archiveConnection.end();
    }
  }
}