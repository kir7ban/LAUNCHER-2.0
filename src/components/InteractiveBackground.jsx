import React, { useRef, useEffect, useCallback } from 'react';
import '../styles/InteractiveBackground.css';

/**
 * Full-screen interactive particle background.
 * Particles drift gently and react to cursor movement —
 * nearby particles are repelled, creating a dynamic ripple.
 * Connected by translucent lines when close enough.
 */
export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef([]);
  const animId = useRef(null);

  const PARTICLE_COUNT = 80;
  const CONNECTION_DIST = 140;
  const MOUSE_RADIUS = 160;
  const MOUSE_FORCE = 0.08;

  const initParticles = useCallback((w, h) => {
    const arr = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2.2 + 1,
        opacity: Math.random() * 0.5 + 0.3,
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w, h;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      if (particles.current.length === 0) {
        particles.current = initParticles(w, h);
      }
    };

    // Reduced motion: draw static particles once, no animation
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      resize();
      window.addEventListener('resize', resize);
      particles.current = initParticles(w, h);
      for (const p of particles.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 86, 145, ${p.opacity})`;
        ctx.fill();
      }
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    const onMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    const onMouseLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const pts = particles.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;

      // Update positions
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];

        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.995;
        p.vy *= 0.995;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(0, 86, 145, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isNear = dist < MOUSE_RADIUS;

        // Glow effect near cursor
        if (isNear) {
          const glowAlpha = (1 - dist / MOUSE_RADIUS) * 0.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 142, 207, ${glowAlpha})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isNear
          ? `rgba(0, 142, 207, ${p.opacity + 0.3})`
          : `rgba(0, 86, 145, ${p.opacity})`;
        ctx.fill();
      }

      // Cursor glow ring
      if (mx > 0 && my > 0) {
        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS);
        gradient.addColorStop(0, 'rgba(0, 142, 207, 0.06)');
        gradient.addColorStop(0.5, 'rgba(0, 86, 145, 0.02)');
        gradient.addColorStop(1, 'rgba(0, 86, 145, 0)');
        ctx.beginPath();
        ctx.arc(mx, my, MOUSE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      animId.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    draw();

    return () => {
      cancelAnimationFrame(animId.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [initParticles]);

  return <canvas ref={canvasRef} className="interactive-bg" />;
}
