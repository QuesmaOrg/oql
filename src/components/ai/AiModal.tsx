import { getBackendSrv } from '@grafana/runtime';
import {  TabularResult } from 'lib/types';
import { getBackendUrl } from '../../constants';
import React, { useCallback, useState } from 'react';

interface AiModalProps {
  position: { x: number; y: number };
  onClose: () => void;
  onAccept: (query: string) => void;
  tabularResult: TabularResult | null;
  query: string;
}

export const AiModal: React.FC<AiModalProps> = ({
  position,
  onClose,
  onAccept,
  query,
  tabularResult
}) => {
  const [aiQuery, setAiQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSuggest = useCallback((prompt: string) => {
    setIsLoading(true);

    getBackendSrv().fetch({
      url: getBackendUrl('suggest'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({ prompt: prompt, query: query, results: tabularResult }),
      showErrorAlert: false
    }).subscribe({
      next: (data) => {
        console.log("suggestions", data);
        const suggestions = (data as any).data.suggestions;
        console.log("suggestions", suggestions);
        setSuggestions(suggestions);
        setSuggestionError(null);
        setIsLoading(false);
      },
      error: (error) => {
        console.error("error", error);
        setSuggestionError(error.data.error);
        setIsLoading(false);
      }
    });


  }, [query, tabularResult]);

  return (
    <div style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      backgroundColor: '#1e1e1e',
      border: '1px solid rgba(204, 204, 220, 0.2)',
      borderRadius: '4px',
      padding: '12px',
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      width: '600px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <label 
          htmlFor="ai-input" 
          style={{ 
            color: 'rgb(204, 204, 220)',
            fontSize: '12px',
            fontWeight: 500
          }}
        >
          Ask AI
        </label>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <input
            id="ai-input"
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#141414',
              border: '1px solid rgba(204, 204, 220, 0.2)',
              borderRadius: '4px',
              padding: '6px 8px',
              color: 'rgb(204, 204, 220)',
              fontSize: '12px'
            }}
            autoFocus
          />
          <button
            disabled={isLoading}
            onClick={() => handleSuggest?.(aiQuery)}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {isLoading ? 'Asking...' : 'Ask'}
          </button>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'none',
          border: 'none',
          color: 'rgb(204, 204, 220)',
          cursor: 'pointer',
          padding: '2px',
          fontSize: '14px'
        }}
      >
        ×
      </button>

      {suggestionError && (
        <div style={{
          color: 'red',
          fontSize: '12px',
        }}> 
          Sorry Dave: {suggestionError}
        </div>
      )}

      {suggestions && suggestions.map((suggestion, index) => (
        <div 
          key={index} 
          style={{
            padding: '4px',
            backgroundColor: '#141414',
            border: '1px solid rgba(204, 204, 220, 0.2)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'rgb(204, 204, 220)',
            cursor: 'pointer',
          }}
          onClick={() => {
            onAccept(suggestion);
          }}
        >
          <pre>{suggestion}</pre>
        </div>
      ))}
    </div>
  );
};
