import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'newdts',
};

async function getConnection() {
  return mysql.createConnection(dbConfig);
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

export async function GET(request: NextRequest) {
  let connection;

  try {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1') || 1;
    const archivedParam = url.searchParams.get('archived');
    const limit = 10;
    const offset = (page - 1) * limit;

    connection = await getConnection();
    await ensureDocumentSchema(connection);

    // Removed automatic archiving logic - documents will only be archived manually

    const [countRows] = await connection.execute(
      'SELECT COUNT(*) AS totalDocuments, SUM(archived = 0) AS activeCount, SUM(archived = 1) AS archivedCount FROM dts_documents'
    );

    const counts = Array.isArray(countRows) && countRows.length > 0 ? (countRows[0] as any) : { totalDocuments: 0, activeCount: 0, archivedCount: 0 };

    const params: Array<string | number> = [];
    let whereClause = '';

    if (archivedParam === '0' || archivedParam === '1') {
      whereClause = 'WHERE archived = ?';
      params.push(Number(archivedParam));
    }

    params.push(limit, offset);

    const [rows] = await connection.execute(
      `SELECT * FROM dts_documents ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );

    return NextResponse.json({
      documents: rows,
      totalDocuments: Number(counts.totalDocuments ?? 0),
      activeCount: Number(counts.activeCount ?? 0),
      archivedCount: Number(counts.archivedCount ?? 0),
      page,
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

    return NextResponse.json({ success: true, id: (result as any).insertId });
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

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const archived = Boolean(body?.archived);
    const archivedValue = archived ? 1 : 0;

    if (!id || typeof body.archived !== 'boolean') {
      return NextResponse.json(
        { message: 'Invalid request payload.' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await ensureDocumentSchema(connection);
    await connection.execute(
      'UPDATE dts_documents SET archived = ?, archived_at = IF(? = 1, NOW(), NULL) WHERE id = ?',
      [archivedValue, archivedValue, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/documents error:', error);
    return NextResponse.json(
      { message: 'Failed to update document.' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
