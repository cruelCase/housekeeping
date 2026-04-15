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

export async function GET(request: NextRequest) {
  let connection;

  try {
    connection = await getConnectionArchive();

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
    const limit = 100;
    const offset = (page - 1) * limit;

    // Get total count
    const [countRows] = await connection.execute(
      'SELECT COUNT(*) as total FROM dts_doc_routes_archives'
    );
    const total = (countRows as any)[0].total;
    const totalPages = Math.ceil(total / limit);

    // Get paginated routes
    const [rows] = await connection.execute(
      `SELECT * FROM dts_doc_routes_archives ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return NextResponse.json({
      routes: rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('GET /api/archived-routes error:', error);
    return NextResponse.json(
      { message: 'Failed to load archived routes.' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function PUT(request: NextRequest) {
  let connection;
  let archiveConnection;

  try {
    const body = await request.json();
    const monthsOld = Number(body?.monthsOld);

    if (isNaN(monthsOld) || monthsOld < 1) {
      return NextResponse.json(
        { message: 'monthsOld must be a valid number greater than 0.' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    archiveConnection = await getConnectionArchive();

    // Ensure archive table exists
    await archiveConnection.execute(`
      CREATE TABLE IF NOT EXISTS dts_doc_routes_archives (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dts_document_id INT,
        route_name VARCHAR(255),
        url_slug VARCHAR(255),
        created_at DATETIME,
        archived_at DATETIME,
        INDEX idx_dts_document_id (dts_document_id),
        INDEX idx_created_at (created_at)
      )
    `);

    // Calculate the date threshold (X months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

    // Get routes older than the threshold
    const [routesToArchive] = await connection.execute(
      'SELECT * FROM dts_doc_routes WHERE created_at < ?',
      [cutoffDate]
    );

    if (!Array.isArray(routesToArchive) || routesToArchive.length === 0) {
      return NextResponse.json({
        success: true,
        archivedCount: 0,
        message: 'No routes found matching the archive criteria.'
      });
    }

    // Insert routes into archive database
    const archiveValues = (routesToArchive as any[]).map((route) => [
      route.dts_document_id ?? null,
      route.route_name ?? null,
      route.url_slug ?? null,
      route.created_at ?? null,
      new Date(), // archived_at
    ]);

    for (const values of archiveValues) {
      await archiveConnection.execute(
        `INSERT INTO dts_doc_routes_archives 
         (dts_document_id, route_name, url_slug, created_at, archived_at) 
         VALUES (?, ?, ?, ?, ?)`,
        values
      );
    }

    // Mark original routes as archived
    await connection.execute(
      'DELETE FROM dts_doc_routes WHERE created_at < ?',
      [cutoffDate]
    );

    return NextResponse.json({
      success: true,
      archivedCount: routesToArchive.length,
      message: `Successfully archived ${routesToArchive.length} routes.`
    });
  } catch (error) {
    console.error('PUT /api/archived-routes error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: `Failed to archive old routes: ${message}` },
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