const STORAGE_KEY = 'party-popper-session';

// 5 minutes in milliseconds (matches backend reconnection window)
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export interface SessionData {
  sessionId: string;
  gameCode: string;
  playerName: string;
  timestamp?: number;
}

export function saveSession(data: Omit<SessionData, 'timestamp'>): void {
  const sessionData: SessionData = {
    ...data,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  } catch (e) {
    console.warn('Failed to save session to localStorage:', e);
  }
}

export function getSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: SessionData = JSON.parse(stored);

    // Check if session is expired
    if (session.timestamp && Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
      clearSession();
      return null;
    }

    return session;
  } catch (e) {
    console.warn('Failed to read session from localStorage:', e);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear session from localStorage:', e);
  }
}

export function isSessionValid(): boolean {
  return getSession() !== null;
}

export function updateSessionTimestamp(): void {
  const session = getSession();
  if (session) {
    saveSession({
      sessionId: session.sessionId,
      gameCode: session.gameCode,
      playerName: session.playerName,
    });
  }
}
