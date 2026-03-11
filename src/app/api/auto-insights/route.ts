import { NextRequest, NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';
import Database from 'better-sqlite3';
import path from 'path';
import { parse } from 'csv-parse/sync';

export const runtime = 'nodejs';

// Use /tmp in production (Vercel) because the root is read-only
const DB_PATH = process.env.VERCEL ? '/tmp/data.db' : path.join(process.cwd(), 'data.db');

export async function POST(req: NextRequest) {
    try {
        const { csvContent } = await req.json().catch(() => ({}));
        
        if (!process.env.HUGGINGFACE_API_KEY) {
            return NextResponse.json({ error: 'Hugging Face API key is not configured' }, { status: 500 });
        }

        let db;
        if (csvContent) {
            // Stateless: Initialize in-memory DB from CSV content
            db = new Database(':memory:');
            const records = parse(csvContent, { columns: true, skip_empty_lines: true });
            if (records.length > 0) {
                const columns = Object.keys(records[0]);
                const cleanColumns = columns.map(col => col.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
                db.exec(`CREATE TABLE data (${cleanColumns.map(col => `"${col}" TEXT`).join(', ')});`);
                const insertStmt = db.prepare(`INSERT INTO data (${cleanColumns.map(col => `"${col}"`).join(', ')}) VALUES (${cleanColumns.map(() => '?').join(', ')});`);
                const insertMany = db.transaction((rows) => {
                    for (const row of rows) insertStmt.run(columns.map(col => row[col]));
                });
                insertMany(records);
            }
        } else {
            // Stateful: Use local file
            db = new Database(DB_PATH);
        }
        const tables: any[] = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

        if (tables.length === 0) {
            db.close();
            return NextResponse.json({ error: 'No data uploaded yet.' }, { status: 400 });
        }

        let schema = '';
        for (const t of tables) {
            const tableInfo: any[] = db.prepare(`PRAGMA table_info("${t.name}")`).all();
            schema += `Table "${t.name}":\nColumns: ${tableInfo.map(col => `${col.name} (${col.type})`).join(', ')}\n\n`;
        }

        const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

        const systemPrompt = `
      You are an expert Data Analyst providing "Day Zero" insights for a non-technical executive.
      Analyze the database schema:
      
      ${schema}
      
      Generate an array of exactly 3 distinct, valuable insights that visually summarize this data.
      These insights should be obvious questions a business owner would ask (e.g. Sales by Region, Top 5 Products, Trend over Time).
      
      You must respond in pure JSON containing an array of objects.
      
      Each object must look like this:
      {
        "content": "A short, exciting sentence describing the insight.",
        "sqlQuery": "A valid SQLite query (SELECT only) to fetch the data.",
        "chartConfig": {
          "type": "bar" | "line" | "pie" | "area",
          "xAxisKey": "column_name",
          "yAxisKey": "column_name",
          "title": "A human-readable chart title",
          "color": "#6366F1"
        }
      }
      
      For pie charts, xAxisKey is used as the nameKey and yAxisKey is used as the dataKey.
      Ensure queries are completely robust and use functions like SUM(), COUNT() if grouping.
      Limit your SQL queries to returning a maximum of 15 rows so charts don't get cluttered.
      `;

        const response = await hf.chatCompletion({
            model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the 3 distinct insights now based strictly on the schema. Only output the JSON array." }
            ],
            max_tokens: 1500,
        });

        let responseText = response.choices[0].message.content || "";
        
        // Aggressive cleaning for LLaMA output
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Remove any text before the first [ or {
        const firstBracket = Math.min(
            responseText.indexOf('[') === -1 ? Infinity : responseText.indexOf('['),
            responseText.indexOf('{') === -1 ? Infinity : responseText.indexOf('{')
        );
        if (firstBracket !== Infinity) {
            responseText = responseText.substring(firstBracket);
        }
        
        // Remove any text after the last ] or }
        const lastBracket = Math.max(responseText.lastIndexOf(']'), responseText.lastIndexOf('}'));
        if (lastBracket !== -1) {
            responseText = responseText.substring(0, lastBracket + 1);
        }

        let aiResponse;
        try {
            aiResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", responseText);
            db.close();
            return NextResponse.json({ error: 'LLM generated invalid format' }, { status: 500 });
        }

        if (!Array.isArray(aiResponse)) {
            aiResponse = [aiResponse]; // Fallback
        }

        const insights = [];
        for (const item of aiResponse) {
            if (item.sqlQuery) {
                try {
                    // Check SELECT
                    if (!item.sqlQuery.trim().toUpperCase().startsWith('SELECT')) continue;

                    const queryData = db.prepare(item.sqlQuery).all();
                    insights.push({
                        content: item.content,
                        sqlQuery: item.sqlQuery,
                        chartConfig: item.chartConfig,
                        chartData: queryData
                    });
                } catch (sqlError: any) {
                    console.error("Auto-insight query failed:", sqlError, item.sqlQuery);
                }
            }
        }

        db.close();
        return NextResponse.json({ insights });
    } catch (error: any) {
        console.error('Auto-insights API error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
