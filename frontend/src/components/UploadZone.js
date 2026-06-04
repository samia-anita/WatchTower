import React, { useRef, useState, useCallback } from 'react';

export default function UploadZone({ onFileSelected, selectedFile, onClear, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

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
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [disabled, handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onInputChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  };

  if (selectedFile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="file-chip">
          <span>📄</span>
          <span>{selectedFile.name}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            ({(selectedFile.size / 1024).toFixed(1)} KB)
          </span>
        </div>
        {!disabled && (
          <button className="file-chip-remove" onClick={onClear} title="Remove file">×</button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`upload-zone ${dragging ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.log"
        onChange={onInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      <span className="upload-icon">🛡️</span>
      <div className="upload-title">Drop your log file here</div>
      <div className="upload-sub">
        Supports Apache, Nginx, syslog, and generic log formats<br />
        .txt or .log &nbsp;·&nbsp; Max 10 MB
      </div>
      <button
        className="btn btn-outline"
        onClick={e => { e.stopPropagation(); !disabled && inputRef.current?.click(); }}
        disabled={disabled}
      >
        Browse Files
      </button>
    </div>
  );
}
