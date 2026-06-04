import React from 'react';

export default function AppHeader({ backendOnline, ollamaStatus }) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="shield-icon">🛡</div>
        <span>WatchTower</span>
        <span className="brand-sub">Security Analyst</span>
      </div>

      <div className="header-right">
        <div className="header-status">
          <div className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span>API {backendOnline ? 'Online' : 'Offline'}</span>
        </div>

        <div className="header-status">
          <div className={`status-dot ${
            ollamaStatus === 'online'   ? 'online'
            : ollamaStatus === 'checking' ? 'warning'
            : 'offline'
          }`} />
          <span>
            {ollamaStatus === 'online'    ? 'Ollama'
             : ollamaStatus === 'checking' ? 'Checking...'
             : 'Ollama Offline'}
          </span>
        </div>

        <span className="cyber-tag">v1.0.0</span>
      </div>
    </header>
  );
}
