import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  size?: number;
}

export function SongQRCode({ spotifyUri, size = 200 }: SongQRCodeProps) {
  // Convert Spotify URI to URL for mobile compatibility
  // URI format: spotify:track:xxxxx
  // URL format: https://open.spotify.com/track/xxxxx
  const spotifyUrl = spotifyUri.startsWith('spotify:')
    ? spotifyUri.replace('spotify:', 'https://open.spotify.com/').replace(/:/g, '/')
    : spotifyUri;

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
