import React from "react";
import { useGlobalLogoUrl } from "../utils/logoState";

interface MunicipalLogoProps {
  className?: string;
  size?: number | string;
}

export default function MunicipalLogo({ className = "", size = 48 }: MunicipalLogoProps) {
  const customLogoUrl = useGlobalLogoUrl();

  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt="Municipal Assembly Logo"
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        className={`shrink-0 select-none rounded-full object-contain bg-white border border-slate-200 p-0.5 ${className}`}
        style={{ width: size, height: size }}
        id="nsawam-municipal-assembly-logo-custom"
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`shrink-0 select-none ${className}`}
      id="nsawam-municipal-assembly-logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft shadow for vector realism */}
        <filter id="logo-drop-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.2" />
        </filter>

        <clipPath id="inner-seal-clip">
          <circle cx="100" cy="100" r="71" />
        </clipPath>
        
        {/* Curved text paths */}
        <path id="top-text-path" d="M 28,100 A 72,72 0 0,1 172,100" fill="none" />
        <path id="bottom-text-path" d="M 172,100 A 72,72 0 0,1 28,100" fill="none" />
        
        {/* High quality gradients */}
        <linearGradient id="pineapple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" /> {/* Amber 500 */}
          <stop offset="40%" stopColor="#ea580c" /> {/* Orange 600 */}
          <stop offset="100%" stopColor="#9a3412" /> {/* Orange/Red 800 */}
        </linearGradient>

        <linearGradient id="leaf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" /> {/* Green 500 */}
          <stop offset="100%" stopColor="#14532d" /> {/* Green 900 */}
        </linearGradient>

        <linearGradient id="leaf-grad-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" /> {/* Green 400 */}
          <stop offset="100%" stopColor="#15803d" /> {/* Green 700 */}
        </linearGradient>

        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" /> {/* Yellow 200 */}
          <stop offset="40%" stopColor="#eab308" /> {/* Yellow 500 */}
          <stop offset="100%" stopColor="#ca8a04" /> {/* Yellow 600 */}
        </linearGradient>

        <linearGradient id="water-blue-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      {/* 1. Outer Green Seal Border */}
      <circle cx="100" cy="100" r="93" fill="#ffffff" stroke="#15803d" strokeWidth="8" />
      
      {/* 2. Concentric inner separation line */}
      <circle cx="100" cy="100" r="82" fill="none" stroke="#16a34a" strokeWidth="1.5" />

      {/* 3. Outer branding text in navy blue */}
      <text fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="11" fill="#1e3a8a" letterSpacing="1">
        <textPath href="#top-text-path" startOffset="50%" textAnchor="middle">
          NSAWAM ADOAGYIRI MUNICIPAL
        </textPath>
      </text>

      <text fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="12" fill="#1e3a8a" letterSpacing="2.5">
        <textPath href="#bottom-text-path" startOffset="50%" textAnchor="middle">
          ASSEMBLY
        </textPath>
      </text>

      {/* 4. Division inner green ring */}
      <circle cx="100" cy="100" r="72" fill="none" stroke="#15803d" strokeWidth="2.5" />

      {/* 5. Central seal body (Clipped to stay inside inner ring) */}
      <g clipPath="url(#inner-seal-clip)">
        {/* Soft white background inside */}
        <circle cx="100" cy="100" r="71" fill="#ffffff" />

        {/* ================= BACKGROUND STOOL SECTION ================= */}
        <g id="traditional-ghanaian-stool" filter="url(#logo-drop-shadow)">
          {/* Black backing silhouette */}
          <path
            d="M 45,78 Q 100,98 155,78 C 150,115 135,145 100,145 C 65,145 50,115 45,78 Z"
            fill="#111111"
            stroke="#000000"
            strokeWidth="1.5"
          />

          {/* Yellow/Gold Stool Seat (Concave U-shape) */}
          <path
            d="M 40,72 Q 100,92 160,72 L 158,80 Q 100,100 42,80 Z"
            fill="url(#gold-grad)"
            stroke="#78350f"
            strokeWidth="1.5"
          />

          {/* Yellow/Gold Stool Base */}
          <path
            d="M 55,142 Q 100,132 145,142 L 140,150 Q 100,140 60,150 Z"
            fill="url(#gold-grad)"
            stroke="#78350f"
            strokeWidth="1.5"
          />

          {/* Golden loops/chains cascading down on sides */}
          <g fill="url(#gold-grad)" stroke="#78350f" strokeWidth="1.2">
            {/* Left side chain of rings */}
            <circle cx="56" cy="94" r="8" />
            <circle cx="52" cy="112" r="9" />
            <circle cx="50" cy="130" r="10" />
            
            {/* Right side chain of rings */}
            <circle cx="144" cy="94" r="8" />
            <circle cx="148" cy="112" r="9" />
            <circle cx="150" cy="130" r="10" />
          </g>

          {/* Inner holes of golden chain rings to give authentic layered look */}
          <g fill="#ffffff" stroke="#78350f" strokeWidth="1">
            <circle cx="56" cy="94" r="3.5" />
            <circle cx="52" cy="112" r="4" />
            <circle cx="50" cy="130" r="4.5" />
            
            <circle cx="144" cy="94" r="3.5" />
            <circle cx="148" cy="112" r="4" />
            <circle cx="150" cy="130" r="4.5" />
          </g>
        </g>

        {/* ================= WATER SECTOR (BOTTOM) ================= */}
        <g id="densu-river-waves" filter="url(#logo-drop-shadow)">
          {/* Wave 1 - Deep Blue */}
          <path
            d="M 20,150 C 50,142 70,158 100,150 C 130,142 150,158 180,150 L 180,180 L 20,180 Z"
            fill="url(#water-blue-grad)"
            opacity="0.85"
          />
          {/* Wave 2 - Sky Blue */}
          <path
            d="M 15,158 C 45,150 65,166 100,158 C 135,150 155,166 185,158 L 185,180 L 15,180 Z"
            fill="#38bdf8"
            opacity="0.75"
          />
          {/* Wave 3 - White / Ice Blue highlights */}
          <path
            d="M 10,165 C 40,157 60,173 100,165 C 140,157 160,173 190,165 L 190,180 L 10,180 Z"
            fill="#e0f2fe"
            opacity="0.9"
          />
        </g>

        {/* ================= PINEAPPLE (CENTERPIECE) ================= */}
        <g id="municipal-pineapple" filter="url(#logo-drop-shadow)">
          {/* Pineapple Crown (Green Leaves, layered in multiple fan shapes) */}
          {/* Back row - dark leaves */}
          <path d="M 100,90 Q 75,55 82,42 Q 95,60 100,90" fill="url(#leaf-grad)" />
          <path d="M 100,90 Q 125,55 118,42 Q 105,60 100,90" fill="url(#leaf-grad)" />
          <path d="M 100,90 Q 60,70 68,54 Q 85,74 100,90" fill="url(#leaf-grad)" />
          <path d="M 100,90 Q 140,70 132,54 Q 115,74 100,90" fill="url(#leaf-grad)" />

          {/* Middle row - medium leaves */}
          <path d="M 100,88 Q 85,42 90,30 Q 98,50 100,88" fill="url(#leaf-grad-light)" />
          <path d="M 100,88 Q 115,42 110,30 Q 102,50 100,88" fill="url(#leaf-grad-light)" />
          <path d="M 100,88 Q 70,50 78,38 Q 90,60 100,88" fill="url(#leaf-grad-light)" />
          <path d="M 100,88 Q 130,50 122,38 Q 110,60 100,88" fill="url(#leaf-grad-light)" />

          {/* Front row - main vertical tall leaves */}
          <path d="M 100,86 Q 90,32 100,18 Q 110,32 100,86" fill="url(#leaf-grad)" />
          <path d="M 100,86 Q 95,38 98,24 Q 102,38 100,86" fill="url(#leaf-grad-light)" stroke="#15803d" strokeWidth="0.5" />

          {/* Pineapple Body (Golden Orange Oval) */}
          <ellipse cx="100" cy="116" rx="25" ry="33" fill="url(#pineapple-grad)" stroke="#78350f" strokeWidth="2.5" />
          
          {/* Diamond Cross-Hatch Grid */}
          {/* Diagonal left-to-right lines */}
          <g stroke="#78350f" strokeWidth="1.5" opacity="0.85">
            <path d="M 86,92 Q 100,106 114,120" fill="none" />
            <path d="M 78,100 Q 100,121 122,142" fill="none" />
            <path d="M 75,112 Q 100,134 118,147" fill="none" />
            <path d="M 80,126 Q 100,143 110,149" fill="none" />

            {/* Diagonal right-to-left lines */}
            <path d="M 114,92 Q 100,106 86,120" fill="none" />
            <path d="M 122,100 Q 100,121 78,142" fill="none" />
            <path d="M 125,112 Q 100,134 82,147" fill="none" />
            <path d="M 120,126 Q 100,143 90,149" fill="none" />
          </g>

          {/* Seeds / Eyes inside diamonds */}
          <g fill="#fef08a" stroke="#78350f" strokeWidth="0.5">
            <circle cx="100" cy="98" r="1.8" />
            <circle cx="100" cy="115" r="1.8" />
            <circle cx="100" cy="132" r="1.8" />
            
            <circle cx="89" cy="107" r="1.8" />
            <circle cx="111" cy="107" r="1.8" />
            
            <circle cx="88" cy="123" r="1.8" />
            <circle cx="112" cy="123" r="1.8" />
            
            <circle cx="94" cy="139" r="1.8" />
            <circle cx="106" cy="139" r="1.8" />
          </g>
        </g>
      </g>
    </svg>
  );
}
