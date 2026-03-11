'use client';

import React from 'react';
import DynamicChart from './DynamicChart';

export interface PinnedItem {
    id: string;
    title: string;
    chartConfig: any;
    chartData: any[];
}

interface DashboardGridProps {
    items: PinnedItem[];
}

export default function DashboardGrid({ items }: DashboardGridProps) {
    if (items.length === 0) {
        return (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginTop: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-primary)' }}>No Saved Insights Yet</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Pin charts from the Chat tab to build your custom presentation dashboard here.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px',
            marginTop: '20px'
        }}>
            {items.map((item) => (
                <div key={item.id} className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '350px', width: '100%' }}>
                        <DynamicChart data={item.chartData} config={item.chartConfig} />
                    </div>
                </div>
            ))}
        </div>
    );
}
