interface AnswerDisplayProps {
  teamName: string;
  artist: string;
  title: string;
  year: number | null;
}

export function AnswerDisplay({ teamName, artist, title, year }: AnswerDisplayProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
      <h2 className="text-3xl font-bold text-white text-center mb-6">
        {teamName}
      </h2>

      <div className="space-y-4">
        <AnswerField label="Artist" value={artist} />
        <AnswerField label="Title" value={title} />
        <AnswerField label="Year" value={year !== null ? String(year) : ''} />
      </div>
    </div>
  );
}

interface AnswerFieldProps {
  label: string;
  value: string;
}

function AnswerField({ label, value }: AnswerFieldProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-400 text-lg w-20">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-lg px-4 py-3 min-h-[48px]">
        <span className="text-2xl text-white font-medium">
          {value || '...'}
        </span>
      </div>
    </div>
  );
}
