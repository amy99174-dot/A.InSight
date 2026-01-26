
import { useState, useRef, useEffect, useCallback } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      // 1. Try preferred settings: Back camera (environment), High Res
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn("Preferred camera config failed, attempting fallback...", err);

      // 2. Fallback: Try ANY available video source
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr: any) {
        console.error("Camera access denied (Fallback):", fallbackErr);

        // Granular Error Handling
        let errorMsg = "相機啟動失敗 (Unknown Error)";
        const errorName = fallbackErr.name || "";

        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          errorMsg = "請允許相機權限 (Permission Denied)";
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          errorMsg = "找不到相機裝置 (No Camera Found)";
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          errorMsg = "相機被佔用或異常 (Hardware Error)";
        } else if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          errorMsg = "瀏覽器限制：需使用 HTTPS 連線"; // Likely cause for Pi
        }

        setError(errorMsg);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const captureImage = useCallback((): string | null => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw the current video frame
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Return base64 string
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return { videoRef, startCamera, stopCamera, captureImage, error, isActive: !!stream };
}
