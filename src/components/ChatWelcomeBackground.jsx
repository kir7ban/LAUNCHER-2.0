import React, { useRef, useEffect, useCallback } from 'react';

const THEME_COLORS = {
  light: {
    particles: [
      [0, 86, 145],    // #005691 Bosch primary blue
      [0, 142, 207],   // #008ecf Bosch secondary blue
      [80, 35, 127],   // #50237f Bosch purple
      [24, 131, 126],  // #18837e Bosch teal
    ],
    glow: [0, 142, 207],
  },
  dark: {
    particles: [
      [26, 140, 255],
      [51, 170, 238],
      [140, 90, 220],
      [40, 200, 190],
    ],
    glow: [51, 170, 238],
  },
};

// Antigravity-style configuration
const PARTICLE_COUNT = 120;
const MAGNET_RADIUS = 150;      // px — how far the magnetic field reaches
const RING_RADIUS = 90;         // px — radius of the ring particles form
const WAVE_SPEED = 0.4;
const WAVE_AMPLITUDE = 1;
const PARTICLE_SIZE = 2;
const LERP_SPEED = 0.06;        // how fast particles move toward ring / home
const PULSE_SPEED = 3;
const FIELD_STRENGTH = 10;
const CAPSULE_RATIO = 2.5;      // length/width of capsule shape
const ROTATION_SPEED = 0.15;    // slow rotation of the ring

/**
 * Antigravity-style particle background for the chat panel.
 * Particles scatter across the area. When the cursor approaches,
 * nearby particles are attracted into a ring formation around it,
 * creating a smooth anti-gravity / magnetic field effect.
 */
export default function ChatWelcomeBackground() {
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
      colorsRef.current = THEME_COLORS[t] || THEME_COLORS.light;
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const getContainer = useCallback((canvas) => {
    return canvas.closest('.split-view') || canvas.closest('.content-area') || canvas.parentElement;
  }, []);

  const initParticles = useCallback((w, h) => {
    const arr = [];
    const colors = colorsRef.current.particles;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const baseSize = (Math.random() * 0.6 + 0.4) * PARTICLE_SIZE;
      const randomRadiusOffset = (Math.random() - 0.5) * 2;
      arr.push({
        // Home (rest) position
        homeX: x,
        homeY: y,
        // Current drawn position
        cx: x,
        cy: y,
        // Animation phase offset
        t: Math.random() * 100,
        speed: 0.01 + Math.random() * 0.005,
        // Size
        baseSize,
        size: baseSize,
        // Opacity
        opacity: 0,
        targetOpacity: Math.random() * 0.5 + 0.15,
        // Ring deviation
        randomRadiusOffset,
        // Rotation angle for capsule
        angle: Math.random() * Math.PI * 2,
        // Color
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = getContainer(canvas);
    let w, h;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w;
      canvas.height = h;
      if (particles.current.length === 0) {
        particles.current = initParticles(w, h);
      }
    };

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      resize();
      particles.current = initParticles(w, h);
      for (const p of particles.current) {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.baseSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.join(',')}, ${p.targetOpacity})`;
        ctx.fill();
      }
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
    };

    const onMouseLeave = () => {
      mouse.current.x = -9999;
      mouse.current.y = -9999;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      timeRef.current += 0.016; // ~60fps timestep
      const globalTime = timeRef.current;
      const pts = particles.current;
      const colors = colorsRef.current;

      // Smooth virtual mouse toward actual mouse
      const smoothFactor = 0.08;
      if (mouse.current.x > -5000) {
        virtualMouse.current.x += (mouse.current.x - virtualMouse.current.x) * smoothFactor;
        virtualMouse.current.y += (mouse.current.y - virtualMouse.current.y) * smoothFactor;
      } else {
        virtualMouse.current.x = -9999;
        virtualMouse.current.y = -9999;
      }

      const mx = virtualMouse.current.x;
      const my = virtualMouse.current.y;
      const mouseActive = mx > -5000;
      const globalRotation = globalTime * ROTATION_SPEED;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.color = colors.particles[i % colors.particles.length];

        // Advance animation phase
        p.t += p.speed;

        // Compute distance from virtual mouse
        const dx = p.homeX - mx;
        const dy = p.homeY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX, targetY, targetSize, targetAngle;

        if (mouseActive && dist < MAGNET_RADIUS) {
          // Particle is within magnetic field — attract to ring
          const angleToMouse = Math.atan2(dy, dx) + globalRotation;
          const wave = Math.sin(p.t * WAVE_SPEED + angleToMouse) * (4 * WAVE_AMPLITUDE);
          const deviation = p.randomRadiusOffset * (5 / (FIELD_STRENGTH + 0.1));
          const currentRingRadius = RING_RADIUS + wave + deviation;

          targetX = mx + currentRingRadius * Math.cos(angleToMouse);
          targetY = my + currentRingRadius * Math.sin(angleToMouse);
          targetAngle = angleToMouse + Math.PI / 2;

          // Pulsing size near ring
          const distFromRing = Math.abs(
            Math.sqrt(Math.pow(p.cx - mx, 2) + Math.pow(p.cy - my, 2)) - RING_RADIUS
          );
          let scaleFactor = 1 - distFromRing / 40;
          scaleFactor = Math.max(0.15, Math.min(1, scaleFactor));
          targetSize = scaleFactor * (0.8 + Math.sin(p.t * PULSE_SPEED) * 0.2) * PARTICLE_SIZE * 1.8;

          // Brighter when on ring
          p.targetOpacity = Math.min(0.8, 0.3 + scaleFactor * 0.5);
        } else {
          // Return to home
          targetX = p.homeX;
          targetY = p.homeY;
          targetSize = p.baseSize;
          targetAngle = p.angle;
          p.targetOpacity = Math.random() > 0.995 ? p.targetOpacity : p.targetOpacity; // stable
          if (p.targetOpacity > 0.5) p.targetOpacity = Math.random() * 0.4 + 0.15;
        }

        // Lerp current position toward target
        p.cx += (targetX - p.cx) * LERP_SPEED;
        p.cy += (targetY - p.cy) * LERP_SPEED;
        p.size += (targetSize - p.size) * LERP_SPEED;
        p.angle += (targetAngle - p.angle) * LERP_SPEED;

        // Fade in on init / fade to target opacity
        const opacitySpeed = 0.03;
        if (p.opacity < p.targetOpacity) {
          p.opacity = Math.min(p.opacity + opacitySpeed, p.targetOpacity);
        } else if (p.opacity > p.targetOpacity) {
          p.opacity = Math.max(p.opacity - opacitySpeed, p.targetOpacity);
        }

        // Draw capsule shape (elongated ellipse)
        const s = Math.max(p.size, 0.3);
        ctx.save();
        ctx.translate(p.cx, p.cy);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * CAPSULE_RATIO, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.join(',')}, ${p.opacity})`;
        ctx.fill();
        ctx.restore();
      }

      animId.current = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    draw();

    return () => {
      cancelAnimationFrame(animId.current);
      ro.disconnect();
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [initParticles, getContainer]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    />
  );
}
