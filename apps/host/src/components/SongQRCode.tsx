import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  size?: number;
}

export function SongQRCode({ spotifyUri, size = 200 }: SongQRCodeProps) {
  // TEMPORARY: Hardcoded URL for testing
  // TODO: Generate proper context URLs for each track
  const spotifyUrl = 'https://open.spotify.com/track/6kUYTpPW0bEwn2qp2A4oCf?context=spotify:playlist:4pSchzZgV2gVZqSQVBMHzm&si=364b5c44225243e1';

  return (
    <div data-testid="song-qr-code" className="bg-white p-4 rounded-lg inline-block">
      <QRCodeSVG
        value={spotifyUrl}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#0f172a"
      />
    </div>
  );
}
