'use client';

import React, { useState } from 'react';
import { Sparkles, Database, LayoutDashboard } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [isDataReady, setIsDataReady] = useState(false);
  const [dataSummary, setDataSummary] = useState<{ rowCount: number, columns: string[] } | null>(null);

  return (
    <div className="home-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--accent-color)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
            <LayoutDashboard size={24} color="white" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Insights AI
          </span>
        </div>

        {isDataReady && dataSummary && (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px 16px', borderRadius: '100px', fontSize: '0.85rem', color: '#10B981' }}>
            <Database size={14} />
            <span>Dataset Active: {dataSummary.rowCount.toLocaleString()} rows</span>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '40px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {!isDataReady ? (
          /* File Upload State */
          <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '40px auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '100px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--accent-color)', marginBottom: '24px', fontSize: '0.875rem', fontWeight: 500 }}>
              <Sparkles size={16} />
              <span>AI-Powered Business Intelligence</span>
            </div>

            <h1 style={{ fontSize: '3.5rem', lineHeight: 1.1, marginBottom: '24px' }}>
              Instant Insights From Your <span style={{ color: 'var(--accent-color)' }}>Data</span>
            </h1>

            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: '48px', maxWidth: '600px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
              Upload any CSV file. Ask natural language questions. Get fully interactive, presentation-ready dashboards in seconds.
            </p>

            <FileUpload onUploadSuccess={(summary) => {
              setDataSummary(summary);
              setIsDataReady(true);
            }} />
          </div>
        ) : (
          /* Chat & Dashboard Interface State */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>Dashboard</h1>
            <ChatInterface />
          </div>
        )}

      </div>
    </div>
  );
}
