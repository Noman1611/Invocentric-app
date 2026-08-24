import React, { useEffect, useRef } from 'react';
import { renderBarcodeSvg, BarcodeOptions, validateBarcode } from '../services/barcodeService';

interface BarcodeCanvasProps {
  options: BarcodeOptions;
  className?: string;
  onError?: (error: string | null) => void;
}

export const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({ options, className, onError }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const validation = validateBarcode(options.type, options.value);
    if (!validation.isValid) {
      if (onError) onError(validation.error || 'Invalid barcode format');
      if (svgRef.current) svgRef.current.innerHTML = '';
      return;
    }

    if (onError) onError(null);
    renderBarcodeSvg(svgRef.current, options);
  }, [options, onError]);

  return (
    <div className="flex items-center justify-center overflow-hidden">
      <svg ref={svgRef} className={className || 'max-w-full h-auto'} />
    </div>
  );
};
