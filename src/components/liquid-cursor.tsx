'use client';

import { useEffect, useRef } from 'react';

/**
 * Liquid mercury cursor: a chrome blob that lags the pointer with spring
 * easing and squishes along its direction of travel. mix-blend-mode:
 * difference keeps it visible over both the dark sky and cream sections.
 * Disabled for touch devices and prefers-reduced-motion.
 */
export function LiquidCursor() {
  const blobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const blob = blobRef.current;
    if (!blob) return;

    document.body.classList.add('liquid-on');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let bx = mx;
    let by = my;
    let started = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!started) {
        bx = mx;
        by = my;
        started = true;
        blob.classList.add('visible');
      }
    };
    const onLeave = () => blob.classList.remove('visible');
    const onEnter = () => blob.classList.add('visible');
    const onDown = () => blob.classList.add('press');
    const onUp = () => blob.classList.remove('press');
    const onOver = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, .cta, .card, .nav-cta')) {
        blob.classList.add('hover');
      }
    };
    const onOut = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button, .cta, .card, .nav-cta')) {
        blob.classList.remove('hover');
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    // Section theming: swap glow tint as dark/light sections cross center.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.documentElement.setAttribute(
              'data-cursor-theme',
              (entry.target as HTMLElement).dataset.cursor ?? 'dark',
            );
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    document.querySelectorAll<HTMLElement>('[data-cursor]').forEach((s) => io.observe(s));

    const frame = () => {
      const dx = mx - bx;
      const dy = my - by;
      bx += dx * 0.16;
      by += dy * 0.16;

      const speed = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const stretch = Math.min(speed * 0.012, 0.55);
      const sx = 1 + stretch;
      const sy = 1 - stretch * 0.6;

      blob.style.transform = `translate3d(${bx}px, ${by}px, 0) rotate(${angle}rad) scale(${sx}, ${sy}) rotate(${-angle}rad)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.body.classList.remove('liquid-on');
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
    };
  }, []);

  return <div ref={blobRef} className="liquid-cursor" aria-hidden />;
}
