'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface FileUploadProps {
    onUploadSuccess: (summary: { rowCount: number, columns: string[] }, content: string) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFile(e.target.files[0]);
        }
    };

    const processFile = async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setUploadStatus('error');
            setErrorMessage('Please upload a valid CSV file.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('idle');
        setErrorMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to upload file');
            }

            const text = await file.text();
            setUploadStatus('success');
            onUploadSuccess({
                rowCount: result.rowCount,
                columns: result.columns
            }, text);

            // Reset after 3 seconds
            setTimeout(() => setUploadStatus('idle'), 3000);

        } catch (err: any) {
            console.error('Upload error:', err);
            setUploadStatus('error');
            setErrorMessage(err.message || 'An unexpected error occurred');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div
            className={`glass-panel`}
            style={{
                padding: '32px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: isDragging ? '2px dashed var(--accent-color)' : '1px solid var(--glass-border)',
                transition: 'all 0.3s ease',
                background: isDragging ? 'rgba(99, 102, 241, 0.05)' : 'var(--glass-bg)'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {isUploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
                    <Loader className="animate-pulse" size={48} color="var(--accent-color)" />
                    <p>Processing Data...</p>
                </div>
            ) : uploadStatus === 'success' ? (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#10B981' }}>
                    <CheckCircle size={48} />
                    <p>Dataset ready for analysis!</p>
                </div>
            ) : uploadStatus === 'error' ? (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#EF4444' }}>
                    <AlertCircle size={48} />
                    <p>{errorMessage}</p>
                    <button className="btn-secondary" onClick={() => setUploadStatus('idle')} style={{ marginTop: '8px' }}>
                        Try Again
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '50%' }}>
                        <UploadCloud size={40} color="var(--accent-color)" />
                    </div>
                    <div>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.25rem' }}>Upload your dataset</h3>
                        <p style={{ fontSize: '0.9rem' }}>Drag and drop a CSV file here, or click below to browse</p>
                    </div>
                    <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                        <FileType size={18} />
                        Select CSV File
                    </button>
                </div>
            )}
        </div>
    );
}
