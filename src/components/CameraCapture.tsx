import React, { useRef, useState, useEffect } from "react";
import { Camera, Image, Check, RefreshCw, AlertCircle } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64String: string) => void;
  savedPhoto?: string;
}

// Preset simulated passport-sized applicant portraits (Ghanaian/West African profiles) for easy sandbox testing inside iframes
const SIMULATED_PORTRAITS = [
  {
    name: "Kofi Mensah (Male Applicant)",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    base64: "MOCK_KOFI_MENSAH_PORTRAIT" // We can fetch or mock. We will store url as base64 string or let server handle mock string
  },
  {
    name: "Ama Serwaa (Female Applicant)",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    base64: "MOCK_AMA_SERWAA_PORTRAIT"
  },
  {
    name: "Emmanuel Osei (Staff Applicant)",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    base64: "MOCK_EMMANUEL_OSEI_PORTRAIT"
  }
];

export default function CameraCapture({ onCapture, savedPhoto }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(savedPhoto || null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  useEffect(() => {
    if (savedPhoto) {
      setPhotoPreview(savedPhoto);
    }
  }, [savedPhoto]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Bind the camera stream to the video element once the video ref is mounted in the DOM or stream changes
  useEffect(() => {
    if (cameraActive && activeStream && videoRef.current) {
      try {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play().catch(e => {
          console.warn("Video stream play was interrupted or failed:", e);
        });
      } catch (err) {
        console.error("Failed to assign media stream to video element:", err);
      }
    }
  }, [cameraActive, activeStream]);

  const startCamera = async (currentFacingMode: "user" | "environment" = facingMode) => {
    setCameraError(null);
    try {
      // If a stream already exists, stop it first before requesting another one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      let stream: MediaStream;
      try {
        // Try with ideal flexible constraints (prevents black screen on hardware supporting strict aspect ratios)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentFacingMode },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (firstErr) {
        console.warn("First constraint attempt failed, trying simpler constraints...", firstErr);
        // Fallback to absolute simplest device constraints for compatibility
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacingMode },
          audio: false
        });
      }

      streamRef.current = stream;
      setActiveStream(stream);
      setCameraActive(true);
      setHasCamera(true);
    } catch (err) {
      console.warn("Camera initialization error:", err);
      setHasCamera(false);
      setCameraActive(false);
      setActiveStream(null);
      setCameraError(
        "Camera stream blocked or unavailable inside sandbox iframe. Please use image upload or select a preset simulated photo."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActiveStream(null);
    setCameraActive(false);
  };

  const toggleFacingMode = async () => {
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacingMode);
    if (cameraActive) {
      await startCamera(nextFacingMode);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Center crop to make square portrait
        const video = videoRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 320, 320);
        
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoPreview(base64);
        onCapture(base64);
        stopCamera();
      }
    } catch (err) {
      console.error("Failed to capture image frame:", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // This photo is stored base64-inline on the application document,
    // which has a hard ~1MB Firestore limit — same reasoning as the other
    // upload caps in ClientBioTab/ApplicationDetails/ClientAllocationLetterTab.
    if (file.size > 650 * 1024) {
      setCameraError("Photo file size exceeds 650KB. Please use a smaller/compressed photo.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      onCapture(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSimulated = (portrait: typeof SIMULATED_PORTRAITS[0]) => {
    // Convert to mock base64 representation using unsplash source url
    setPhotoPreview(portrait.url);
    onCapture(portrait.url);
  };

  return (
    <div className="space-y-4" id="camera-capture-container">
      <label className="block text-sm font-medium text-slate-700">
        Applicant Passport Photo <span className="text-red-500">*</span>
      </label>

      {/* Camera Live Preview / Snapshot Preview Box */}
      <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
        {cameraActive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Camera Facing Switcher Button Overlay */}
            <button
              type="button"
              onClick={toggleFacingMode}
              className="absolute top-2 right-2 bg-indigo-900/90 hover:bg-indigo-900 text-white rounded-full px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 z-10"
              title="Switch Camera (Front/Back)"
              id="toggle-facing-mode-btn"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{facingMode === "user" ? "Back Camera" : "Front Camera"}</span>
            </button>

            <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-indigo-900 hover:bg-indigo-800 text-white rounded-full p-4 shadow-lg flex items-center justify-center border-4 border-white transition-all transform active:scale-95"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
          </>
        ) : photoPreview ? (
          <>
            <img
              src={photoPreview}
              referrerPolicy="no-referrer"
              alt="Applicant Passport Portrait"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setPhotoPreview(null);
                startCamera();
              }}
              className="absolute top-2 right-2 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full p-2 text-xs flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake
            </button>
            <div className="absolute bottom-2 left-2 bg-emerald-600 text-white px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow">
              <Check className="w-3 h-3" /> Captured
            </div>
          </>
        ) : (
          <div className="text-center p-6 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700">No Image Selected</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {import.meta.env.DEV ? "Take a photo, upload an image, or use a simulated portrait" : "Take a photo or upload an image"}
              </p>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 mx-auto"
            >
              <Camera className="w-3.5 h-3.5" /> Start Native Camera
            </button>
          </div>
        )}
      </div>

      {/* Fallback & Sandbox Simulation Options */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3 text-xs">
        {cameraError && (
          <div className="flex gap-1.5 text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="font-semibold text-slate-600 flex items-center gap-1">
            <Image className="w-3.5 h-3.5" /> Option A: Standard File Upload
          </span>
          <label className="cursor-pointer text-indigo-900 hover:text-indigo-800 font-semibold">
            Browse
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* Dev/testing only: a stock-photo picker has no business being
            reachable in production for a Ghana Card-linked identity
            record — someone could register a real tenant using a fake
            portrait instead of an actual captured photo. import.meta.env.DEV
            is Vite's built-in flag (true only under `vite dev`, always
            false in a production build), so this block is compiled out of
            what actually ships. */}
        {import.meta.env.DEV && (
          <div className="space-y-2">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Option B: Simulate Applicant Portrait (dev only)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SIMULATED_PORTRAITS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSimulated(p)}
                  className="group relative rounded-lg overflow-hidden aspect-square border-2 border-transparent hover:border-indigo-900 transition-all text-left"
                  title={p.name}
                >
                  <img
                    src={p.url}
                    referrerPolicy="no-referrer"
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white leading-none font-medium truncate w-full">
                      {p.name.split(" ")[0]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
