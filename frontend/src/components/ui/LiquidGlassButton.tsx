"use client";

import React from "react";

interface LiquidGlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary";
}

// SVG Filter Component
const GlassFilter: React.FC = () => (
  <svg style={{ display: "none" }}>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="200"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  children,
  onClick,
  className = "",
  variant = "primary",
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
  };

  const variantClasses = {
    primary: "bg-gradient-primary text-white",
    secondary: "bg-white/25 text-white",
  };

  return (
    <>
      <GlassFilter />
      <button
        onClick={onClick}
        className={`relative inline-flex items-center justify-center font-semibold overflow-hidden cursor-pointer transition-all duration-700 rounded-3xl px-10 py-6 hover:px-11 hover:py-7 hover:rounded-[2rem] ${variantClasses[variant]} ${className}`}
        style={glassStyle}
      >
        {/* Glass Layers */}
        <div
          className="absolute inset-0 z-0 overflow-hidden rounded-3xl"
          style={{
            backdropFilter: "blur(3px)",
            filter: "url(#glass-distortion)",
            isolation: "isolate",
          }}
        />
        <div
          className="absolute inset-0 z-10 rounded-3xl"
          style={{ background: "rgba(255, 255, 255, 0.25)" }}
        />
        <div
          className="absolute inset-0 z-20 rounded-3xl overflow-hidden"
          style={{
            boxShadow:
              "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
          }}
        />

        {/* Content */}
        <div
          className="relative z-30 transition-all duration-700 hover:scale-95 text-center"
          style={{
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
        >
          {children}
        </div>
      </button>
    </>
  );
};
