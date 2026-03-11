'use client';

import React from 'react';
import {
    BarChart, Bar,
    LineChart, Line,
    PieChart, Pie, Cell,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ChartConfig {
    type: string;
    xAxisKey: string;
    yAxisKey: string;
    title: string;
    color: string | string[];
}

interface DynamicChartProps {
    data: any[];
    config: ChartConfig;
}

export default function DynamicChart({ data, config }: DynamicChartProps) {
    if (!data || data.length === 0) return null;

    const { type, xAxisKey, yAxisKey, title, color } = config;
    const mainColor = Array.isArray(color) ? color[0] : (color || '#6366F1');
    const colors = Array.isArray(color) ? color : ['#6366F1', '#10B981', '#F43F5E', '#8B5CF6', '#F59E0B', '#3B82F6'];

    const renderTooltip = () => (
        <Tooltip
            contentStyle={{
                backgroundColor: 'rgba(21, 26, 35, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
            }}
            itemStyle={{ color: '#fff' }}
        />
    );

    const getChartLabelStyle = { fill: 'var(--text-secondary)', fontSize: 12 };

    const renderChart = () => {
        switch (type.toLowerCase()) {
            case 'bar':
                return (
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey={xAxisKey} tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        <YAxis tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        {renderTooltip()}
                        <Bar dataKey={yAxisKey} fill={mainColor} radius={[4, 4, 0, 0]} />
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey={xAxisKey} tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        <YAxis tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        {renderTooltip()}
                        <Line type="monotone" dataKey={yAxisKey} stroke={mainColor} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                );

            case 'pie':
                return (
                    <PieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            innerRadius={40}
                            fill={mainColor}
                            dataKey={yAxisKey}
                            nameKey={xAxisKey}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                const radius = (innerRadius || 0) + ((outerRadius || 0) - (innerRadius || 0)) * 0.5;
                                const x = cx + radius * Math.cos(-(midAngle || 0) * Math.PI / 180);
                                const y = cy + radius * Math.sin(-(midAngle || 0) * Math.PI / 180);
                                return (percent || 0) > 0.05 ? (
                                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={500}>
                                        {`${((percent || 0) * 100).toFixed(0)}%`}
                                    </text>
                                ) : null;
                            }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                            ))}
                        </Pie>
                        {renderTooltip()}
                        <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
                    </PieChart>
                );

            case 'area':
                return (
                    <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <defs>
                            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={mainColor} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey={xAxisKey} tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        <YAxis tick={getChartLabelStyle} axisLine={false} tickLine={false} />
                        {renderTooltip()}
                        <Area type="monotone" dataKey={yAxisKey} stroke={mainColor} fillOpacity={1} fill="url(#colorUv)" />
                    </AreaChart>
                );

            default:
                return <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>Unsupported chart type: {type}</div>;
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'center' }}>{title}</h3>
            <div style={{ flex: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
