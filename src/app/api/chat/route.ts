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
        const { query, forecast, csvContent } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        if (!process.env.HUGGINGFACE_API_KEY) {
            return NextResponse.json({ error: 'Hugging Face API key is not configured' }, { status: 500 });
        }

        let db;
        if (csvContent) {
            // Stateless: Initialize in-memory DB from CSV content
            db = new Database(':memory:');
            const records = parse(csvContent, { columns: true, skip_empty_lines: true });
            if (records.length > 0) {
                const columns = Object.keys(records[0] as any);
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

        // Check if any tables exist
        const tables: any[] = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

        if (tables.length === 0) {
            db.close();
            return NextResponse.json({ error: 'No data uploaded yet. Please upload a CSV first.' }, { status: 400 });
        }

        // Get the schema of all tables
        let schema = '';
        for (const t of tables) {
            const tableInfo: any[] = db.prepare(`PRAGMA table_info("${t.name}")`).all();
            schema += `Table "${t.name}":\nColumns: ${tableInfo.map(col => `${col.name} (${col.type})`).join(', ')}\n\n`;
        }

        // Initialize Gemini
        const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

        const systemPrompt = `
      You are an expert Data Analyst and SQL Developer generating intelligent insights for a non-technical executive.
      
      You must respond in pure JSON format containing two keys: "sqlQuery" and "chartConfig".
      
      The user will ask a business question in natural language.
      We have an SQLite database with the following schema:
      
      ${schema}
      
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

        const response = await hf.chatCompletion({
            model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `User Query: ${query}` }
            ],
            max_tokens: 1500,
        });

        let responseText = response.choices[0].message.content || "";
        
        // Aggressive cleaning for LLaMA output
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Remove any text before the first {
        const firstBrace = responseText.indexOf('{');
        if (firstBrace !== -1) {
            responseText = responseText.substring(firstBrace);
        }
        
        // Remove any text after the last }
        const lastBrace = responseText.lastIndexOf('}');
        if (lastBrace !== -1) {
            responseText = responseText.substring(0, lastBrace + 1);
        }

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

            // Forecasting Logic
            if (forecast && queryData.length >= 3 && ['line', 'area', 'bar'].includes(aiResponse.chartConfig.type)) {
                try {
                    const forecastPrompt = `
                    You are a data forecasting AI. 
                    Based on this historical data: ${JSON.stringify(queryData)}
                    Extrapolate the next 3 to 6 periods. 
                    The x-axis key is "${aiResponse.chartConfig.xAxisKey}" and the y-axis key is "${aiResponse.chartConfig.yAxisKey}".
                    Return ONLY a valid JSON array of the new extrapolated data objects. 
                    Make sure the x-axis keys are formatted similarly to the historical data, but append " (Forecast)" or similar to indicate it's a prediction.
                    `;

                    const forecastResult = await hf.chatCompletion({
                        model: "meta-llama/Meta-Llama-3-8B-Instruct",
                        messages: [
                            { role: "system", content: "You are a data forecasting AI. Only output a valid JSON array." },
                            { role: "user", content: forecastPrompt }
                        ],
                        max_tokens: 1000,
                    });
                    
                    let forecastText = forecastResult.choices[0].message.content || "";
                    if (forecastText.startsWith('\`\`\`json')) {
                        forecastText = forecastText.slice(7, -3).trim();
                    } else if (forecastText.startsWith('\`\`\`')) {
                        forecastText = forecastText.slice(3, -3).trim();
                    }

                    const forecastData = JSON.parse(forecastText);
                    if (Array.isArray(forecastData)) {
                        queryData = [...queryData, ...forecastData];
                    }
                } catch (e) {
                    console.error("Forecasting prediction failed, returning original data", e);
                }
            }

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
