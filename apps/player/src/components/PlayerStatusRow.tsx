interface PlayerStatusRowProps {
  playerName: string;
  team: 'A' | 'B';
  teamName: string;
  isTeamLeader: boolean;
}

export function PlayerStatusRow({ playerName, team, teamName, isTeamLeader }: PlayerStatusRowProps) {
  const teamColor = team === 'A' ? 'text-blue-400' : 'text-red-400';
  const bgColor = team === 'A' ? 'bg-blue-900/30' : 'bg-red-900/30';

  return (
    <div className={`flex items-center justify-between px-4 py-2 ${bgColor} border-b border-white/10`}>
      <div className="flex items-center gap-2">
        {isTeamLeader && <span className="text-yellow-400">👑</span>}
        <span className="text-white font-medium">{playerName}</span>
      </div>
      <span className={`text-sm font-medium ${teamColor}`}>{teamName}</span>
    </div>
  );
}
