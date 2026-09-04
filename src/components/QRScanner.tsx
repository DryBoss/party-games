import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    scannedRef.current = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        video &&
        canvas &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        !scannedRef.current
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            scannedRef.current = true;
            onScan(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        setError("Couldn't access the camera. You can paste the code instead.");
      });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/90 p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center border-[3px] border-paper bg-ink text-paper"
      >
        <X className="h-5 w-5" />
      </button>

      {error ? (
        <>
          <p className="max-w-xs text-center text-paper">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 border-[3px] border-paper bg-transparent px-5 py-2 font-medium text-paper"
          >
            Close
          </button>
        </>
      ) : (
        <>
          <div className="relative w-full max-w-sm overflow-hidden border-[3px] border-paper">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted playsInline className="w-full" />
          </div>
          <p className="mt-4 text-sm text-paper/70">Point the camera at the QR code</p>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
