import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScrollableTabBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  containerClassName?: string;
  scrollStep?: number;
  showArrowsAlways?: boolean;
}

export const ScrollableTabBar: React.FC<ScrollableTabBarProps> = ({
  children,
  className,
  containerClassName,
  scrollStep = 240,
  ...props
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, children]);

  const scrollBy = (amount: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: amount,
      behavior: 'smooth'
    });
  };

  // Mouse drag-to-scroll support for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click and if not clicking a button directly
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'button' || target.closest('button')) {
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollStart.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollStart.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  return (
    <div className={cn("relative group/scroll flex items-center w-full max-w-full min-w-0", containerClassName)}>
      {/* Left Scroll Button & Fade Overlay */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center pr-4 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={(e) => {
              e.stopPropagation();
              scrollBy(-scrollStep);
            }}
            className="pointer-events-auto p-1.5 sm:p-2 rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all flex items-center justify-center cursor-pointer -ml-1 sm:-ml-2"
          >
            <ChevronLeft size={16} className="shrink-0" />
          </button>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={cn(
          "w-full overflow-x-auto scroll-smooth no-scrollbar flex items-center select-none py-1",
          className
        )}
        {...props}
      >
        {children}
      </div>

      {/* Right Scroll Button & Fade Overlay */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pl-4 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none">
          <button
            type="button"
            aria-label="Scroll right"
            onClick={(e) => {
              e.stopPropagation();
              scrollBy(scrollStep);
            }}
            className="pointer-events-auto p-1.5 sm:p-2 rounded-full bg-white text-slate-700 shadow-md border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all flex items-center justify-center cursor-pointer -mr-1 sm:-mr-2"
          >
            <ChevronRight size={16} className="shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};
export default ScrollableTabBar;
