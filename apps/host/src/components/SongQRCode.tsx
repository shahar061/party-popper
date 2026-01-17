import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  size?: number;
}

export function SongQRCode({ spotifyUri, size = 200 }: SongQRCodeProps) {
  // Extract track ID from URI (spotify:track:xxxxx)
  const trackId = spotifyUri.split(':')[2];

  // Use open.spotify.com URL which automatically redirects to app if installed
  // Adding ?go=1 parameter triggers automatic app opening on mobile
  const spotifyUrl = `https://open.spotify.com/track/${trackId}?go=1`;

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
