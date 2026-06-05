import React, { useRef, useState, useCallback } from 'react';

function UploadCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16,16 12,12 8,16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
    </svg>
  );
}
function FileDocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
}

export default function UploadZone({ onFileSelected, selectedFile, onClear, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [pasteText, setPasteText] = useState('');

  const handleFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'log'].includes(ext)) {
      alert('Only .txt and .log files are accepted');
      return;
    }
    onFileSelected(file);
  }, [onFileSelected]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    if (disabled || mode !== 'file') return;
    handleFile(e.dataTransfer.files[0]);
  }, [disabled, handleFile, mode]);

  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onInputChange = (e) => { handleFile(e.target.files[0]); e.target.value = ''; };

  const handlePasteAnalyze = useCallback(() => {
    if (!pasteText.trim()) return;
    const blob = new Blob([pasteText], { type: 'text/plain' });
    const file = new File([blob], `pasted-log-${Date.now()}.txt`, { type: 'text/plain' });
    onFileSelected(file);
  }, [pasteText, onFileSelected]);

  const handleSystemPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setPasteText(text);
    } catch {
      /* clipboard not accessible, user can type manually */
    }
  }, []);

  if (selectedFile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="file-chip">
          <FileDocIcon />
          <span>{selectedFile.name}</span>
          <span className="file-chip-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
        </div>
        {!disabled && (
          <button className="file-chip-remove" onClick={() => { setPasteText(''); onClear(); }} title="Remove">
            <XIcon />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Mode tabs */}
      <div className="upload-tabs">
        <button className={`upload-tab ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload File
        </button>
        <button className={`upload-tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>
          <ClipboardIcon />
          Paste Text
        </button>
      </div>

      {mode === 'file' && (
        <div
          className={`upload-zone ${dragging ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
          style={{ borderRadius: '0 8px 8px 8px' }}
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        >
          <input ref={inputRef} type="file" accept=".txt,.log" onChange={onInputChange} style={{ display: 'none' }} disabled={disabled} />
          <div className="scan-line" />
          <div className="upload-icon-box">
            <div className="upload-icon-ring" />
            <UploadCloudIcon />
          </div>
          <div className="upload-title">{dragging ? '🎯 Release to scan this file' : 'Drop your log file here'}</div>
          <div className="upload-sub">Apache · Nginx · Syslog · Generic formats accepted</div>
          <button className="btn btn-outline" onClick={e => { e.stopPropagation(); !disabled && inputRef.current?.click(); }} disabled={disabled}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Browse Files
          </button>
          <div className="upload-formats">
            <span className="fmt-tag">.log</span>
            <span className="fmt-tag">.txt</span>
            <span className="fmt-tag">max 10 mb</span>
          </div>
        </div>
      )}

      {mode === 'paste' && (
        <div className="paste-zone">
          <div className="paste-zone-header">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paste raw log content below</span>
            <button className="topbar-btn btn-sm" onClick={handleSystemPaste} style={{ padding: '4px 10px', fontSize: 11 }}>
              <ClipboardIcon />
              Paste from clipboard
            </button>
          </div>
          <textarea
            className="paste-textarea"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={'192.168.1.1 - - [15/Jan/2024:10:23:45 +0000] "GET /page HTTP/1.1" 200 1234\n192.168.1.2 - - [15/Jan/2024:10:23:46 +0000] "GET /\' OR 1=1-- HTTP/1.1" 400 512\n...'}
            disabled={disabled}
            spellCheck={false}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
              {pasteText.split('\n').filter(Boolean).length} lines
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {pasteText && (
                <button className="btn btn-ghost btn-sm" onClick={() => setPasteText('')}>Clear</button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handlePasteAnalyze}
                disabled={disabled || !pasteText.trim()}
              >
                Analyze Pasted Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
