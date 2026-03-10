'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, Database, ChevronRight, RefreshCw } from 'lucide-react';
import DynamicChart from './DynamicChart';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chartConfig?: any;
    chartData?: any[];
    sqlQuery?: string;
    isError?: boolean;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am your AI Business Intelligence assistant. You can ask me questions about the data you just uploaded in plain English.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userQuery = input.trim();
        setInput('');

        // Add user message
        const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userQuery };
        setMessages(prev => [...prev, newUserMsg]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userQuery })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate insights');
            }

            // Add assistant success message
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'a',
                role: 'assistant',
                content: `Here is the analysis for: "${userQuery}"`,
                chartConfig: data.chartConfig,
                chartData: data.data,
                sqlQuery: data.generatedSql
            }]);

        } catch (err: any) {
            // Add error message
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'e',
                role: 'assistant',
                content: err.message || 'An error occurred while analyzing the data.',
                isError: true
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px', maxHeight: '80vh', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                    <Bot size={20} color="var(--accent-color)" />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Insights Assistant</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Powered by Gemini 2.5</p>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {messages.map((msg) => (
                    <div key={msg.id} className="animate-fade-in" style={{ display: 'flex', gap: '16px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>

                        {/* Avatar */}
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: msg.role === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                            border: msg.role === 'user' ? 'none' : '1px solid var(--glass-border)'
                        }}>
                            {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="var(--text-primary)" />}
                        </div>

                        {/* Content Bubble */}
                        <div style={{
                            maxWidth: msg.role === 'user' ? '70%' : '85%',
                            display: 'flex', flexDirection: 'column', gap: '12px'
                        }}>

                            {/* Text Message */}
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                background: msg.role === 'user' ? 'var(--accent-color)' : 'rgba(0,0,0,0.2)',
                                color: msg.isError ? '#EF4444' : 'white',
                                border: msg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : (msg.role === 'user' ? 'none' : '1px solid var(--glass-border)'),
                                borderTopRightRadius: msg.role === 'user' ? '4px' : 'var(--radius-md)',
                                borderTopLeftRadius: msg.role === 'user' ? 'var(--radius-md)' : '4px',
                                fontSize: '0.95rem',
                                lineHeight: 1.5
                            }}>
                                {msg.isError && <AlertCircle size={16} style={{ display: 'inline', marginBottom: '-3px', marginRight: '6px' }} />}
                                {msg.content}
                            </div>

                            {/* Advanced UI Payload (Charts & SQL) */}
                            {msg.chartConfig && msg.chartData && !msg.isError && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>

                                    {/* Generated SQL Accordion (Simplified) */}
                                    <div className="glass-card" style={{ padding: '12px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            <Database size={14} />
                                            <span style={{ fontWeight: 500 }}>Generated SQL Query</span>
                                        </div>
                                        <code style={{ color: '#10B981', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '4px', display: 'block', wordBreak: 'break-all' }}>
                                            {msg.sqlQuery}
                                        </code>
                                    </div>

                                    {/* Dynamic Chart Container */}
                                    <div className="glass-card" style={{ padding: '24px', height: '400px', width: '100%' }}>
                                        <DynamicChart data={msg.chartData} config={msg.chartConfig} />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="animate-fade-in" style={{ display: 'flex', gap: '16px', flexDirection: 'row' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                            <Bot size={18} color="var(--text-primary)" />
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <RefreshCw size={16} className="animate-pulse" color="var(--accent-color)" />
                            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Analyzing dataset and formatting charts...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
                <form onSubmit={handleSubmit} style={{ position: 'relative', display: 'flex', gap: '12px' }}>
                    <input
                        type="text"
                        className="input-field"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question about your data... (e.g. 'Show me monthly revenue for Q3')"
                        disabled={isLoading}
                        style={{ paddingRight: '50px' }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            background: input.trim() && !isLoading ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                            color: 'white', border: 'none', width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Send size={18} style={{ marginLeft: '-2px' }} />
                    </button>
                </form>
            </div>
        </div>
    );
}
