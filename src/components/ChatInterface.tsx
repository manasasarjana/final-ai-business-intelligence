'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, Database, ChevronRight, RefreshCw, Pin, Download, Image as ImageIcon, Mic, MicOff } from 'lucide-react';
import DynamicChart from './DynamicChart';
import { PinnedItem } from './DashboardGrid';
import html2canvas from 'html2canvas';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    chartConfig?: any;
    chartData?: any[];
    sqlQuery?: string;
    isError?: boolean;
}

interface ChatInterfaceProps {
    onPin?: (item: PinnedItem) => void;
    pinnedIds?: string[];
    csvContent?: string;
}

export default function ChatInterface({ onPin, pinnedIds = [], csvContent = '' }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am your AI Business Intelligence assistant. You can ask me questions about the data you just uploaded in plain English.'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isForecasting, setIsForecasting] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initialFetchDone = useRef(false);
    const recognitionRef = useRef<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;

                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setInput(prev => prev + (prev ? ' ' : '') + transcript);
                    setIsListening(false);
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                    // Add an error message to chat if microphone fails
                    if (event.error === 'not-allowed') {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString() + 'e-mic',
                            role: 'assistant',
                            content: 'Microphone access was denied. Please allow microphone permissions in your browser settings.',
                            isError: true
                        }]);
                    } else if (event.error === 'network') {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString() + 'e-mic',
                            role: 'assistant',
                            content: 'Network error occurred during speech recognition. Ensure you are online.',
                            isError: true
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString() + 'e-mic',
                            role: 'assistant',
                            content: `Speech recognition failed with error: ${event.error}`,
                            isError: true
                        }]);
                    }
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            try {
                if (!recognitionRef.current) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString() + 'e-mic',
                        role: 'assistant',
                        content: 'Voice input is not supported in this browser. Try using Google Chrome or Edge.',
                        isError: true
                    }]);
                    return;
                }
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Failed to start listening", e);
                setIsListening(false);
            }
        }
    };

    useEffect(() => {
        if (initialFetchDone.current || !csvContent) return;
        initialFetchDone.current = true;

        const fetchInsights = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/auto-insights', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csvContent })
                });
                const data = await response.json();

                if (response.ok && data.insights && data.insights.length > 0) {
                    const insightMsgs: Message[] = data.insights.map((insight: any, index: number) => ({
                        id: `auto-${Date.now()}-${index}`,
                        role: 'assistant',
                        content: insight.content,
                        chartConfig: insight.chartConfig,
                        chartData: insight.chartData,
                        sqlQuery: insight.sqlQuery
                    }));

                    setMessages(prev => [...prev, ...insightMsgs]);
                }
            } catch (err) {
                console.error("Failed to load auto-insights", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [csvContent]);

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
                body: JSON.stringify({ query: userQuery, forecast: isForecasting, csvContent })
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
                                    <div className="glass-card" style={{ padding: '24px', height: '400px', width: '100%', position: 'relative' }}>
                                        {onPin && (
                                            <button
                                                onClick={() => onPin({
                                                    id: msg.id,
                                                    title: msg.chartConfig.title,
                                                    chartConfig: msg.chartConfig,
                                                    chartData: msg.chartData!
                                                })}
                                                disabled={pinnedIds.includes(msg.id)}
                                                style={{
                                                    position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                                                    background: pinnedIds.includes(msg.id) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)',
                                                    color: pinnedIds.includes(msg.id) ? '#10B981' : 'white',
                                                    border: '1px solid var(--glass-border)',
                                                    padding: '6px 12px', borderRadius: '4px', cursor: pinnedIds.includes(msg.id) ? 'default' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', transition: 'all 0.2s'
                                                }}
                                            >
                                                <Pin size={14} />
                                                {pinnedIds.includes(msg.id) ? 'Pinned' : 'Pin to Dashboard'}
                                            </button>
                                        )}
                                        {/* Export Buttons */}
                                        <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => {
                                                    const keys = Object.keys(msg.chartData![0]);
                                                    const csv = [
                                                        keys.join(','),
                                                        ...msg.chartData!.map((r: any) => keys.map(k => `"${r[k]}"`).join(','))
                                                    ].join('\n');
                                                    const blob = new Blob([csv], { type: 'text/csv' });
                                                    const a = document.createElement('a');
                                                    a.href = URL.createObjectURL(blob);
                                                    a.download = `${msg.chartConfig.title.replace(/\s+/g, '_')}.csv`;
                                                    a.click();
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)',
                                                    padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', transition: 'all 0.2s'
                                                }}
                                                title="Download Data as CSV"
                                            >
                                                <Download size={12} /> CSV
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const el = document.getElementById(`chart-wrapper-${msg.id}`);
                                                    if (el) {
                                                        const canvas = await html2canvas(el, { backgroundColor: '#151A23' });
                                                        const a = document.createElement('a');
                                                        a.download = `${msg.chartConfig.title.replace(/\s+/g, '_')}.png`;
                                                        a.href = canvas.toDataURL();
                                                        a.click();
                                                    }
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)',
                                                    padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', transition: 'all 0.2s'
                                                }}
                                                title="Download Chart as PNG"
                                            >
                                                <ImageIcon size={12} /> PNG
                                            </button>
                                        </div>
                                        <div id={`chart-wrapper-${msg.id}`} style={{ width: '100%', height: '100%' }}>
                                            <DynamicChart data={msg.chartData} config={msg.chartConfig} />
                                        </div>
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
                <form onSubmit={handleSubmit} style={{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => setIsForecasting(!isForecasting)}
                        style={{
                            background: isForecasting ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                            color: isForecasting ? 'white' : 'var(--text-secondary)',
                            border: '1px solid', borderColor: isForecasting ? 'var(--accent-color)' : 'var(--glass-border)',
                            padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'all 0.2s'
                        }}
                        title="Enable AI Forecasting (Extrapolates 3-6 periods)"
                    >
                        <Bot size={14} /> Forecast: {isForecasting ? 'ON' : 'OFF'}
                    </button>

                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            className="input-field"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a question about your data... (e.g. 'Show me monthly revenue for Q3')"
                            disabled={isLoading}
                            style={{ paddingRight: '90px', width: '100%' }}
                        />
                        <button
                            type="button"
                            onClick={toggleListening}
                            title={recognitionRef.current ? "Click to speak" : "Voice input not supported"}
                            disabled={!recognitionRef.current || isLoading}
                            style={{
                                position: 'absolute', right: '48px', top: '50%', transform: 'translateY(-50%)',
                                background: 'transparent', color: isListening ? '#EF4444' : 'var(--text-secondary)',
                                border: 'none', cursor: (!recognitionRef.current || isLoading) ? 'not-allowed' : 'pointer',
                                padding: '8px', zIndex: 5, transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                            }}
                        >
                            {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
                        </button>
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
                    </div>
                </form>
            </div>
        </div>
    );
}
