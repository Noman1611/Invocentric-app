import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps & { iconColor?: string; showBg?: boolean }> = ({ 
  className, 
  size = 44, 
  style, 
  iconColor, 
  showBg = true
}) => {
  const defaultColor = showBg ? "#FFFFFF" : "#0F645D";
  const finalColor = iconColor || defaultColor;

  return (
    <div 
      className={cn("flex items-center justify-center shrink-0 overflow-hidden", showBg && "bg-[#0F645D] rounded-full", className)}
      style={{
        ...style,
        width: size,
        height: size,
      }}
      role="img"
      aria-label="InvoCentric Logo"
    >
      <svg 
        viewBox="0 0 500 500" 
        xmlns="http://www.w3.org/2000/svg"
        className={cn("w-full h-full", showBg ? "scale-[0.75]" : "scale-[0.88]")}
        aria-hidden="true"
        style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision', imageRendering: 'optimizeQuality' }}
      >
        <title>InvoCentric Logo</title>
        <g>
          <path fill={finalColor} d="M432.7,268c-17.2-4.9-35.1,5.1-39.9,22.3c-0.1,0.3-0.1,0.4-0.2,0.7c-11.4,39.7-37.9,72-74.4,90.9c-35.2,18.3-75.5,21.7-113.4,9.7c-37.8-12-68.8-38-87-73.3c-18.3-35.2-21.7-75.5-9.7-113.4s38-68.8,73.3-87c36.6-19.1,80-21.8,118.9-7.9c16.8,6.1,35.3-2.6,41.4-19.4c6.1-16.8-2.6-35.3-19.4-41.4c-55.8-20.1-118.1-16-170.7,11.3c-50.6,26.3-88,70.6-105.2,125c-0.5,1.9-1.2,3.9-1.8,5.8c-15.1,52.6-9.6,108.1,15.7,156.9c54.2,104.5,183.2,145.4,287.7,91.3C400,412.6,438.9,365,455,308.8c0.1-0.3,0.2-0.5,0.2-0.7C460,290.8,449.9,272.9,432.7,268z"/>
          <ellipse fill={finalColor} cx="420.6" cy="149.9" rx="43.1" ry="43.1"/>
          <path fill={finalColor} d="M324.8,191l-95.1,86.8l-31.8-35.6c-12.7-15.1-35.2-16.9-50.2-4.3c-15.1,12.7-16.9,35.2-4.3,50.2l31.7,35.6c12.4,14.7,29.2,23.2,46.8,25c17.9,2,36.4-2.9,51.8-14.9l95.1-86.8c15.5-12.1,18.1-34.6,6-50C362.6,181.5,340.3,178.8,324.8,191z"/>
        </g>
      </svg>
    </div>
  );
};
