import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync'; // using sync parser for simplicity since we convert to buffer
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

// Use a persistent SQLite file in development
const DB_PATH = path.join(process.cwd(), 'data.db');

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

        const columns = Object.keys(records[0]);

        // Clean column names for SQLite (remove spaces/special characters)
        const cleanColumns = columns.map(col => col.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());

        // Connect to SQLite
        const db = new Database(DB_PATH);

        // Dynamic Drop & Create Table named "dataset"
        db.exec(`DROP TABLE IF EXISTS dataset;`);

        const createTableQuery = `
      CREATE TABLE dataset (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${cleanColumns.map(col => `"${col}" TEXT`).join(', ')}
      );
    `;
        db.exec(createTableQuery);

        // Insert Data
        const insertQuery = `
      INSERT INTO dataset (${cleanColumns.map(col => `"${col}"`).join(', ')})
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
            columns: cleanColumns
        });

    } catch (error: any) {
        console.error('File processing error:', error);
        return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 });
    }
}
