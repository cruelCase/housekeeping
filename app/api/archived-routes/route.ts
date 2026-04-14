import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfigArchive = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'uniquearchdoc',
};

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