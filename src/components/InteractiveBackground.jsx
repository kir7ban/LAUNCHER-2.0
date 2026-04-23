import React, { useRef, useEffect, useCallback } from 'react';
import '../styles/InteractiveBackground.css';

const THEME_COLORS = {
  light: {
    particles: [
      [59, 130, 246],   // blue
      [99, 102, 241],   // indigo
      [139, 92, 246],   // purple
      [168, 85, 247],   // violet
      [236, 72, 153],   // pink
    ],
  },
  dark: {
    particles: [
      [96, 165, 250],   // light blue
      [129, 140, 248],  // light indigo
      [167, 139, 250],  // light purple
      [196, 148, 252],  // light violet
      [244, 114, 182],  // light pink
    ],
  },
};

// Ring-attraction configuration (inspired by Antigravity CSS rework)
const PARTICLE_COUNT = 140;
const MAGNET_RADIUS = 250;        // how far the magnetic field reaches
const RING_RADIUS_MIN = 120;      // ring oscillates between min and max
const RING_RADIUS_MAX = 200;
const RING_CYCLE = 6;             // seconds for one ring radius cycle
const WAVE_SPEED = 0.4;
const WAVE_AMPLITUDE = 4;
const LERP_SPEED = 0.06;          // how fast particles move toward ring / home
const MOUSE_SMOOTH = 0.08;        // virtual mouse smoothing factor
const ROTATION_SPEED = 0.15;      // slow rotation of the ring
const DRIFT_SPEED = 0.0005;
const DRIFT_AMPLITUDE = 12;

/**
 * Full-screen interactive particle background.
 * Colored dash-shaped particles scatter across the viewport.
 * When the cursor approaches, nearby particles are attracted
 * into a ring formation, creating an antigravity / magnetic field effect.
 */
export default function InteractiveBackground() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const virtualMouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef([]);
  const animId = useRef(null);
  const colorsRef = useRef(THEME_COLORS.light);
  const timeRef = useRef(0);

  useEffect(() => {
    const update = () => {
      const t = document.documentElement.getAttribute('data-theme') || 'light';
      const next = THEME_COLORS[t] || THEME_COLORS.light;
      colorsRef.current = next;
      const colors = next.particles;
      particles.current.forEach((p, i) => {
        p.color = colors[i % colors.length];
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const initParticles = useCallback((w, h) => {
    const arr = [];
    const colors = colorsRef.current.particles;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      arr.push({
        homeX: x,
        homeY: y,
        x,
        y,
        rotation: Math.random() * Math.PI,
        targetRotation: Math.random() * Math.PI,
        length: Math.random() * 8 + 6,
        width: Math.random() * 1.5 + 1.5,
        color: colors[i % colors.length],
        opacity: 0,
        targetOpacity: Math.random() * 0.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        radiusOffset: (Math.random() - 0.5) * 20,
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

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      resize();
      window.addEventListener('resize', resize);
      particles.current = initParticles(w, h);
      for (const p of particles.current) {
        p.opacity = p.targetOpacity;
        const halfLen = p.length / 2;
        const halfWid = p.width / 2;
        const radius = halfWid;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-halfLen, -halfWid, p.length, p.width, radius);
        } else {
          ctx.rect(-halfLen, -halfWid, p.length, p.width);
        }
        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.opacity})`;
        ctx.fill();
        ctx.restore();
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
      timeRef.current += 0.016;
      const globalTime = timeRef.current;
      const pts = particles.current;

      // Smooth virtual mouse toward actual mouse
      if (mouse.current.x > -5000) {
        virtualMouse.current.x += (mouse.current.x - virtualMouse.current.x) * MOUSE_SMOOTH;
        virtualMouse.current.y += (mouse.current.y - virtualMouse.current.y) * MOUSE_SMOOTH;
      } else {
        virtualMouse.current.x = -9999;
        virtualMouse.current.y = -9999;
      }

      const mx = virtualMouse.current.x;
      const my = virtualMouse.current.y;
      const mouseActive = mx > -5000;

      // Oscillating ring radius
      const ringRadius = RING_RADIUS_MIN +
        (RING_RADIUS_MAX - RING_RADIUS_MIN) *
        (0.5 + 0.5 * Math.sin(globalTime * (Math.PI * 2 / RING_CYCLE)));

      const globalRotation = globalTime * ROTATION_SPEED;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];

        // Distance from home to virtual mouse
        const dx = p.homeX - mx;
        const dy = p.homeY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX, targetY, targetRotation;

        if (mouseActive && dist < MAGNET_RADIUS) {
          // Particle is within magnetic field — attract to ring
          const angleToMouse = Math.atan2(dy, dx) + globalRotation;
          const wave = Math.sin(p.phase + globalTime * WAVE_SPEED + angleToMouse) * WAVE_AMPLITUDE;
          const currentRingRadius = ringRadius + wave + p.radiusOffset;

          targetX = mx + currentRingRadius * Math.cos(angleToMouse);
          targetY = my + currentRingRadius * Math.sin(angleToMouse);
          targetRotation = angleToMouse + Math.PI / 2;

          // Brighten when on ring
          const distFromRing = Math.abs(
            Math.sqrt(Math.pow(p.x - mx, 2) + Math.pow(p.y - my, 2)) - ringRadius
          );
          const scaleFactor = Math.max(0.15, Math.min(1, 1 - distFromRing / 60));
          p.targetOpacity = Math.min(0.85, 0.3 + scaleFactor * 0.55);
        } else {
          // Return to home with ambient drift
          const driftX = Math.sin(globalTime * DRIFT_SPEED * 1000 + p.phase) * DRIFT_AMPLITUDE;
          const driftY = Math.cos(globalTime * DRIFT_SPEED * 700 + p.phase * 1.3) * DRIFT_AMPLITUDE;
          targetX = p.homeX + driftX;
          targetY = p.homeY + driftY;
          targetRotation = p.rotation; // keep current angle
          if (p.targetOpacity > 0.5) p.targetOpacity = Math.random() * 0.4 + 0.15;
        }

        // Lerp toward target
        p.x += (targetX - p.x) * LERP_SPEED;
        p.y += (targetY - p.y) * LERP_SPEED;
        p.rotation += (targetRotation - p.rotation) * LERP_SPEED;

        // Fade opacity
        const opacitySpeed = 0.025;
        if (p.opacity < p.targetOpacity) {
          p.opacity = Math.min(p.opacity + opacitySpeed, p.targetOpacity);
        } else if (p.opacity > p.targetOpacity) {
          p.opacity = Math.max(p.opacity - opacitySpeed, p.targetOpacity);
        }

        // Draw dash
        const halfLen = p.length / 2;
        const halfWid = p.width / 2;
        const radius = halfWid;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-halfLen, -halfWid, p.length, p.width, radius);
        } else {
          ctx.rect(-halfLen, -halfWid, p.length, p.width);
        }
        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.opacity})`;
        ctx.fill();
        ctx.restore();
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
