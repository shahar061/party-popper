import { QRCodeSVG } from 'qrcode.react';

interface SongQRCodeProps {
  spotifyUri: string;
  gameCode: string;
  size?: number;
}

// Party Popper playlist containing all game songs
const PLAYLIST_ID = '7KZdOsKtIGfE9YKiJjyM8I';

export function SongQRCode({ spotifyUri, gameCode, size = 200 }: SongQRCodeProps) {
  // Use dedicated QR URL for phone scanning (must be publicly accessible via tunnel)
  // Falls back to API_URL for backwards compatibility
  const QR_BASE_URL = import.meta.env.VITE_QR_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8787';

  // Extract track ID from spotify URI (spotify:track:XXX -> XXX)
  const trackId = spotifyUri.startsWith('spotify:track:')
    ? spotifyUri.replace('spotify:track:', '')
    : spotifyUri;

  // Build Spotify URL with playlist context for auto-play
  const spotifyUrl = `https://open.spotify.com/track/${trackId}?context=spotify:playlist:${PLAYLIST_ID}`;

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
