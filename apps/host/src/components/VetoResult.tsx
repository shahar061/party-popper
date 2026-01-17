// apps/host/src/components/VetoResult.tsx
interface VetoResultProps {
  success: boolean;
  challengingTeam: 'A' | 'B';
  teamName: string;
}

export function VetoResult({ success, teamName }: VetoResultProps) {
  return (
    <div
      data-testid="veto-result"
      className={`fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-fadeIn border-4 ${
        success ? 'border-green-500 shadow-green-500/30' : 'border-red-500 shadow-red-500/30'
      } shadow-2xl`}
    >
      <div
        className="bg-gray-900 rounded-3xl p-16 text-center"
      >
        {success ? (
          <>
            <div className="text-6xl mb-6">🎯</div>
            <div className="text-4xl font-bold text-green-400 mb-4">
              STEAL OPPORTUNITY!
            </div>
            <div className="text-2xl text-white mb-2">
              <span className="font-bold">{teamName}</span> challenged correctly!
            </div>
            <div className="text-xl text-gray-400">
              Answer the song to steal the point
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-6">❌</div>
            <div className="text-4xl font-bold text-red-400 mb-4">
              CHALLENGE FAILED
            </div>
            <div className="text-2xl text-white mb-2">
              The answer was correct
            </div>
            <div className="text-xl text-yellow-400 flex items-center justify-center gap-2">
              <span>🪙</span>
              <span>Token lost</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
