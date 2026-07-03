import React, { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Native canvas signature implementation (replaces react-signature-canvas) ─

interface NativeSigCanvasProps {
  penColor?: string;
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
}

export interface NativeSigCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
  getTrimmedCanvas: () => HTMLCanvasElement;
}

export const NativeSigCanvas = forwardRef<NativeSigCanvasHandle, NativeSigCanvasProps>(
  ({ penColor = '#1E293B', canvasProps }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasStrokes = useRef(false);

    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const pos = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ('touches' in e) {
        const t = e.touches[0];
        return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
      }
      const me = e as React.MouseEvent;
      return { x: (me.clientX - rect.left) * scaleX, y: (me.clientY - rect.top) * scaleY };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const ctx = getCtx(); if (!ctx) return;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!drawing.current) return;
      const ctx = getCtx(); if (!ctx) return;
      const { x, y } = pos(e);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = penColor;
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
    };

    const stopDraw = () => { drawing.current = false; };

    // Resize observer: re-initialize canvas dimensions
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Set logical size from layout if no explicit width/height
      if (!canvasProps?.width) canvas.width = canvas.offsetWidth || 400;
      if (!canvasProps?.height) canvas.height = canvas.offsetHeight || 140;
    }, [canvasProps?.width, canvasProps?.height]);

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
        hasStrokes.current = false;
      },
      isEmpty() {
        if (!hasStrokes.current) return true;
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        if (!ctx) return true;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return !data.some((v, i) => i % 4 === 3 && v > 0);
      },
      getTrimmedCanvas() {
        return canvasRef.current!;
      },
    }));

    const { className: canvasClassName, style: canvasStyle, ...restCanvasProps } = canvasProps ?? {};

    return (
      <canvas
        ref={canvasRef}
        {...restCanvasProps}
        className={cn('touch-none cursor-crosshair', canvasClassName)}
        style={{ ...canvasStyle, display: 'block' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
    );
  }
);
NativeSigCanvas.displayName = 'NativeSigCanvas';

// ─── SignaturePad wrapper component ──────────────────────────────────────────

interface SignaturePadProps {
  label?: string;
  onSave: (dataUrl: string) => void;
  existingUrl?: string | null;
  className?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSave, existingUrl, className }) => {
  const sigRef = useRef<NativeSigCanvasHandle>(null);

  const handleClear = useCallback(() => sigRef.current?.clear(), []);

  const handleSave = useCallback(() => {
    if (sigRef.current?.isEmpty()) return;
    const dataUrl = sigRef.current?.getTrimmedCanvas().toDataURL('image/png') ?? '';
    onSave(dataUrl);
  }, [onSave]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {existingUrl ? (
        <div className="space-y-2">
          <div className="rounded border border-border bg-white p-2">
            <img src={existingUrl} alt="Signature" className="h-20 max-w-full object-contain" />
          </div>
          <p className="text-xs text-muted-foreground">Signature captured</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded border-2 border-border bg-white">
            <NativeSigCanvas
              ref={sigRef}
              penColor="#1E293B"
              canvasProps={{ width: 400, height: 140, className: 'w-full rounded' }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>Clear</Button>
            <Button type="button" size="sm" onClick={handleSave}>Save Signature</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
