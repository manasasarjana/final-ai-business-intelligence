import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import path from 'path';

export const runtime = 'nodejs';

const DB_PATH = path.join(process.cwd(), 'data.db');

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
        }

        // Connect to SQLite to get the schema
        const db = new Database(DB_PATH);

        // Check if dataset table exists
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dataset'").get();

        if (!tableExists) {
            db.close();
            return NextResponse.json({ error: 'No data uploaded yet. Please upload a CSV first.' }, { status: 400 });
        }

        // Get the schema of the dataset table
        const tableInfo: any[] = db.prepare("PRAGMA table_info('dataset')").all();
        const schema = tableInfo.map(col => `${col.name} (${col.type})`).join(', ');

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const systemPrompt = `
      You are an expert Data Analyst and SQL Developer generating intelligent insights for a non-technical executive.
      
      You must respond in pure JSON format containing two keys: "sqlQuery" and "chartConfig".
      
      The user will ask a business question in natural language.
      We have an SQLite database with ONE table named "dataset".
      The table schema is: ${schema}
      
      YOUR TASK:
      1. Analyze the user's intent.
      2. Write a valid SQLite query to fetch the exact data needed to answer their question. The query MUST be safe, read-only (SELECT only), and robust.
      3. Recommend the BEST chart type to visualize this data (line, bar, pie, or area).
      4. Note: If the user asks something completely unrelated to the data or data analysis (e.g. "Who is the president?"), set "sqlQuery" to null and "chartConfig" to null, and add an "error" key explaining clearly that this question cannot be answered with the current dataset.

      RULES FOR CHART CONFIG:
      - "type": "bar", "line", "pie", or "area"
      - "xAxisKey": The column from your SQL query to use for the X-axis (usually a category or date). For pie charts, use this as the "nameKey".
      - "yAxisKey": The column from your SQL query containing the numeric value for the Y-axis. For pie charts, use this as the "dataKey".
      - "title": A professional, human-readable title for the chart.
      - "color": A hex color code (use modern, premium colors like #6366F1, #10B981, #F43F5E, #8B5CF6). Provide an array of colors if it's a pie chart.

      EXAMPLE OUTPUT:
      {
        "sqlQuery": "SELECT region, SUM(sales) as total_sales FROM dataset GROUP BY region ORDER BY total_sales DESC LIMIT 5",
        "chartConfig": {
          "type": "bar",
          "xAxisKey": "region",
          "yAxisKey": "total_sales",
          "title": "Top 5 Regions by Total Sales",
          "color": "#6366F1"
        }
      }
    `;

        const result = await model.generateContent([
            systemPrompt,
            `User Query: ${query}`
        ]);

        const responseText = result.response.text();

        let aiResponse;
        try {
            aiResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", responseText);
            db.close();
            return NextResponse.json({ error: 'LLM generated invalid format' }, { status: 500 });
        }

        if (aiResponse.error || !aiResponse.sqlQuery) {
            db.close();
            return NextResponse.json({ error: aiResponse.error || 'Could not understand the query relative to the data.' }, { status: 400 });
        }

        // Execute the SQL Query safely
        let queryData;
        try {
            // Basic safeguard: ensure it starts with SELECT
            if (!aiResponse.sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
                throw new Error('Only SELECT queries are allowed.');
            }
            queryData = db.prepare(aiResponse.sqlQuery).all();
        } catch (sqlError: any) {
            console.error("SQL Execution Error:", sqlError, "Query:", aiResponse.sqlQuery);
            db.close();
            return NextResponse.json({ error: `Failed to execute data query: ${sqlError.message}` }, { status: 500 });
        }

        db.close();

        return NextResponse.json({
            data: queryData,
            chartConfig: aiResponse.chartConfig,
            generatedSql: aiResponse.sqlQuery
        });

    } catch (error: any) {
        console.error('Chat API error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
