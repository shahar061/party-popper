import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  gameCode: string;
  size?: number;
}

export function SongQRCode({ spotifyUri, gameCode, size = 200 }: SongQRCodeProps) {
  // Use dedicated QR URL for phone scanning (must be publicly accessible via tunnel)
  // Falls back to API_URL for backwards compatibility
  const QR_BASE_URL = import.meta.env.VITE_QR_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8787';

  // TEMPORARY: Hardcoded URL for testing with playlist context
  // TODO: Generate proper context URLs for each track based on spotifyUri
  const spotifyUrl = 'https://open.spotify.com/track/6kUYTpPW0bEwn2qp2A4oCf?context=spotify:playlist:4pSchzZgV2gVZqSQVBMHzm&si=364b5c44225243e1';

  // Generate tracking URL that redirects to Spotify
  const trackingUrl = `${QR_BASE_URL}/qr/track?code=${gameCode}&spotify=${encodeURIComponent(spotifyUrl)}`;

  return (
    <div data-testid="song-qr-code" className="bg-white p-4 rounded-lg inline-block">
      <QRCodeSVG
        value={trackingUrl}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#0f172a"
      />
    </div>
  );
}
