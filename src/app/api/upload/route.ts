import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync'; // using sync parser for simplicity since we convert to buffer
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Use a persistent SQLite file in development
// Use /tmp in production (Vercel) because the root is read-only
const DB_PATH = process.env.VERCEL ? '/tmp/data.db' : path.join(process.cwd(), 'data.db');

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const textContext = buffer.toString('utf-8');

        // Parse CSV
        const records = parse(textContext, {
            columns: true,
            skip_empty_lines: true,
        });

        if (records.length === 0) {
            return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
        }

        const columns = Object.keys(records[0] as Record<string, any>);

        // Clean column names for SQLite (remove spaces/special characters)
        const cleanColumns = columns.map(col => col.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());

        // Derive table name from file name
        let tableName = file.name.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        if (/^[0-9]/.test(tableName)) tableName = 't_' + tableName;
        if (!tableName) tableName = 'dataset_' + Date.now();

        // Connect to SQLite
        console.log('Connecting to DB at:', DB_PATH);
        const db = new Database(DB_PATH);

        // Dynamic Drop & Create Table
        db.exec(`DROP TABLE IF EXISTS "${tableName}";`);

        const createTableQuery = `
      CREATE TABLE "${tableName}" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${cleanColumns.map(col => `"${col}" TEXT`).join(', ')}
      );
    `;
        db.exec(createTableQuery);

        // Insert Data
        const insertQuery = `
      INSERT INTO "${tableName}" (${cleanColumns.map(col => `"${col}"`).join(', ')})
      VALUES (${cleanColumns.map(() => '?').join(', ')});
    `;

        const insertStmt = db.prepare(insertQuery);

        // Use transaction for speed
        const insertMany = db.transaction((rows: any[]) => {
            for (const row of rows) {
                const values = columns.map(col => row[col]);
                insertStmt.run(values);
            }
        });

        insertMany(records);
        db.close();

        return NextResponse.json({
            success: true,
            rowCount: records.length,
            columns: cleanColumns,
            tableName: tableName
        });

    } catch (error: any) {
        console.error('SERVER SIDE UPLOAD ERROR:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to process file',
            details: error.stack,
            path: DB_PATH
        }, { status: 500 });
    }
}
