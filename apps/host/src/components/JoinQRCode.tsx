import { QRCodeSVG } from 'qrcode.react';

interface JoinQRCodeProps {
  url: string;
  size?: number;
}

export function JoinQRCode({ url, size = 200 }: JoinQRCodeProps) {
  return (
    <div className="bg-white p-4 rounded-xl">
      <QRCodeSVG
        value={url}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#0f172a"
      />
    </div>
  );
}
