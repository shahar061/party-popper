import { useState, useCallback, useEffect } from 'react';

interface JoinGameState {
  code: string;
  name: string;
  isLoading: boolean;
  error: string | null;
}

interface UseJoinGameReturn extends JoinGameState {
  setCode: (code: string) => void;
  setName: (name: string) => void;
  isValid: boolean;
}

export function useJoinGame(): UseJoinGameReturn {
  const [state, setState] = useState<JoinGameState>({
    code: '',
    name: '',
    isLoading: false,
    error: null,
  });

  // Pre-fill code from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.length === 4) {
      setState(prev => ({ ...prev, code: codeParam.toUpperCase() }));
    }
  }, []);

  const setCode = useCallback((code: string) => {
    // Auto-uppercase and limit to 4 chars, alphanumeric only
    const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setState(prev => ({ ...prev, code: sanitized, error: null }));
  }, []);

  const setName = useCallback((name: string) => {
    // Limit to 20 chars
    const sanitized = name.slice(0, 20);
    setState(prev => ({ ...prev, name: sanitized, error: null }));
  }, []);

  const isValid = state.code.length === 4 && state.name.trim().length > 0;

  return {
    ...state,
    setCode,
    setName,
    isValid,
  };
}
