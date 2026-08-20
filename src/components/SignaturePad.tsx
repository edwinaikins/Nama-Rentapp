import React, { useRef, useState, useEffect } from "react";
import { PenTool, Trash2, Upload, Check, RefreshCw } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  initialValue?: string | null;
  label?: string;
  placeholderText?: string;
}

export default function SignaturePad({
  onSave,
  onClear,
  initialValue = null,
  label = "Authorized Signature",
  placeholderText = "Draw your signature above or upload a clean signature image"
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialValue);
  const [signatureImg, setSignatureImg] = useState<string | null>(initialValue);
  const [isDrawMode, setIsDrawMode] = useState(!initialValue);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Mirrors signatureImg without forcing the resize effect below to
  // re-subscribe on every stroke — read via .current inside the resize
  // handler so it always sees the latest saved signature, not whatever it
  // was when the listener was first attached.
  const signatureImgRef = useRef<string | null>(initialValue);
  useEffect(() => {
    signatureImgRef.current = signatureImg;
  }, [signatureImg]);

  // Set up canvas sizes and handle high DPI displays
  useEffect(() => {
    if (!isDrawMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      // Get container width
      const width = canvas.parentElement?.clientWidth || 400;
      const height = 210;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Set scale based on device pixel ratio for smooth lines
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#0f172a"; // deep slate-900 / dark color

      // Resizing a <canvas> clears its backing bitmap — that's a browser
      // platform behavior, not something we can opt out of. If a signature
      // was already drawn/saved in this session, redraw it onto the fresh
      // canvas now, so a window resize/rotation doesn't show "not signed"
      // while a saved signature is still attached to the form underneath.
      if (signatureImgRef.current) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = signatureImgRef.current;
        setHasSignature(true);
      } else {
        setHasSignature(false);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [isDrawMode]);

  // Helper to get coordinates
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Check if it is a touch event
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  // Start Drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  // Draw
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  // Stop Drawing & Save data
  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureImg(dataUrl);
    onSave(dataUrl);
  };

  // Clear signature
  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
    setSignatureImg(null);
    if (onClear) onClear();
    onSave("");
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB. Please upload a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignatureImg(base64);
      setHasSignature(true);
      setIsDrawMode(false);
      onSave(base64);
    };
    reader.onerror = () => {
      alert("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50" ref={containerRef}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIsDrawMode(!isDrawMode);
              if (!isDrawMode) {
                handleClear();
              }
            }}
            className="text-[9px] font-semibold text-indigo-700 hover:text-indigo-950 flex items-center gap-1 bg-white border border-indigo-100 px-2 py-0.5 rounded shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            {isDrawMode ? "Use Image Upload" : "Draw Signature"}
          </button>
        </div>
      </div>

      {isDrawMode ? (
        <div className="relative border border-slate-200 bg-white rounded-lg overflow-hidden h-[210px] shadow-inner">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="absolute inset-0 cursor-crosshair w-full h-full touch-none"
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none text-slate-400 select-none">
              <PenTool className="w-6 h-6 text-slate-300 stroke-1" />
              <p className="text-[10px] font-medium mt-1.5">{placeholderText}</p>
              <p className="text-[8px] mt-0.5 opacity-80">(Draw inside this box)</p>
            </div>
          )}
          {hasSignature && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute bottom-2 right-2 p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md shadow border border-red-200 transition-all cursor-pointer"
              title="Clear Drawing"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="border border-slate-200 bg-white rounded-lg p-3 text-center min-h-[210px] flex flex-col items-center justify-center relative shadow-sm">
          {signatureImg ? (
            <div className="space-y-2 py-2">
              <div className="border border-dashed border-slate-150 p-3 rounded-xl bg-slate-50 flex items-center justify-center max-w-[340px] mx-auto">
                <img src={signatureImg} alt="Uploaded Signature" className="max-h-32 max-w-[300px] object-contain block mx-auto" />
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-bold text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-200 px-2 py-1 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-2.5 h-2.5" /> Change Image
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[9px] font-bold text-red-600 hover:text-red-800 bg-red-50 border border-red-100 px-2 py-1 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-full w-10 h-10 flex items-center justify-center mx-auto border border-slate-100">
                <Upload className="w-5 h-5 text-slate-400 stroke-1" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-slate-500">No Signature Image Loaded</p>
                <p className="text-[8px] text-slate-400">Upload a clean transparent PNG signature image</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-[10px] rounded-lg shadow cursor-pointer inline-flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Select Image
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
