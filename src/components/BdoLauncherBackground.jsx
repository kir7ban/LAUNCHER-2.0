import { useRef, useEffect } from 'react';
import * as THREE from 'three';

// Shaders extracted from bdo-launcher-bg@1.0.1
const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  varying vec2 vUv;
  varying float vSize;
  varying vec2 vPos;

  attribute vec3 aOffset;
  attribute float aRandom;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  mat2 rotate2d(float angle) {
    return mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  }

  void main() {
    vUv = uv;
    vec3 pos = aOffset;

    // Alive flow drift
    float driftSpeed = uTime * 0.15;
    float dx = sin(driftSpeed + pos.y * 0.5) + sin(driftSpeed * 0.5 + pos.y * 2.0);
    float dy = cos(driftSpeed + pos.x * 0.5) + cos(driftSpeed * 0.5 + pos.x * 2.0);
    pos.x += dx * 0.25;
    pos.y += dy * 0.25;

    // Jellyfish halo
    vec2 relToMouse   = pos.xy - uMouse;
    float distFromMouse = length(relToMouse);
    float angleToMouse  = atan(relToMouse.y, relToMouse.x);
    float shapeFactor   = noise(vec2(angleToMouse * 2.0, uTime * 0.1));
    float breathCycle   = sin(uTime * 0.8);
    float currentRadius = 2.2 + breathCycle * 0.3 + shapeFactor * 0.5;
    float rimWidth      = 1.8;
    float rimInfluence  = smoothstep(rimWidth, 0.0, abs(distFromMouse - currentRadius));

    // Breath push
    vec2 pushDir = normalize(relToMouse + vec2(0.0001, 0.0));
    float pushAmt = (breathCycle * 0.5 + 0.5) * 0.5;
    pos.xy += pushDir * pushAmt * rimInfluence;
    pos.z  += rimInfluence * 0.3 * sin(uTime);

    // Size
    float baseSize    = 0.012 + sin(uTime + pos.x) * 0.003;
    float currentScale = baseSize + rimInfluence * 0.055;
    float stretch      = rimInfluence * 0.02;

    vec3 transformed = position;
    transformed.x *= (currentScale + stretch);
    transformed.y *=  currentScale * 0.85;

    vSize = rimInfluence;
    vPos  = pos.xy;

    // Radial rotation toward mouse
    transformed.xy = rotate2d(angleToMouse) * transformed.xy;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + transformed, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vSize;
  varying vec2 vPos;

  void main() {
    vec2 center = vec2(0.5);
    vec2 pos = abs(vUv - center) * 2.0;
    float d     = pow(pow(pos.x, 2.6) + pow(pos.y, 2.6), 1.0 / 2.6);
    float alpha = 1.0 - smoothstep(0.8, 1.0, d);
    if (alpha < 0.01) discard;

    vec3 black   = vec3(0.08, 0.08, 0.10);
    vec3 cBlue   = vec3(0.26, 0.52, 0.96);
    vec3 cRed    = vec3(0.92, 0.26, 0.21);
    vec3 cYellow = vec3(0.98, 0.73, 0.01);

    float t  = uTime * 1.2;
    float p1 = sin(vPos.x * 0.8 + t);
    float p2 = sin(vPos.y * 0.8 + t * 0.8 + p1);

    vec3 activeColor = mix(cBlue, cRed, p1 * 0.5 + 0.5);
    activeColor      = mix(activeColor, cYellow, p2 * 0.5 + 0.5);

    vec3  finalColor = mix(black, activeColor, smoothstep(0.1, 0.8, vSize));
    float finalAlpha = alpha * mix(0.4, 0.95, vSize);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

const COLS  = 100;
const ROWS  = 55;
const COUNT = COLS * ROWS; // 5 500 particles

export default function BdoLauncherBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // fully transparent
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 8;

    // ── Geometry & shader material ────────────────────────────
    const geo      = new THREE.PlaneGeometry(1, 1);
    const uniforms = {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite:  false,
    });

    // ── Instanced mesh ────────────────────────────────────────
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    scene.add(mesh);

    // Per-instance attributes (matching bdo-launcher-bg exactly)
    const offsets      = new Float32Array(COUNT * 3);
    const randoms      = new Float32Array(COUNT);
    const angleOffsets = new Float32Array(COUNT);
    let idx = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let x = 40 * (col / 99 - 0.5);
        let y = 22 * (row / 54 - 0.5);
        x += 0.25 * (Math.random() - 0.5);
        y += 0.25 * (Math.random() - 0.5);
        offsets[idx * 3]     = x;
        offsets[idx * 3 + 1] = y;
        offsets[idx * 3 + 2] = 0;
        randoms[idx]          = Math.random();
        angleOffsets[idx]     = Math.random() * Math.PI * 2;
        idx++;
      }
    }
    geo.setAttribute('aOffset',      new THREE.InstancedBufferAttribute(offsets,      3));
    geo.setAttribute('aRandom',      new THREE.InstancedBufferAttribute(randoms,      1));
    geo.setAttribute('aAngleOffset', new THREE.InstancedBufferAttribute(angleOffsets, 1));

    // ── Mouse tracking (world-space coords matching R3F pointer) ──
    const mouseWorld = { x: 0, y: 0 };
    let mouseActive  = true;

    const toWorldCoords = (clientX, clientY) => {
      const aspect = window.innerWidth / window.innerHeight;
      const viewH  = 2 * Math.tan((45 / 2) * Math.PI / 180) * camera.position.z;
      const viewW  = viewH * aspect;
      const ndcX   =  (clientX / window.innerWidth)  * 2 - 1;
      const ndcY   = -((clientY / window.innerHeight) * 2 - 1);
      return { x: ndcX * viewW / 2, y: ndcY * viewH / 2 };
    };

    const onMouseMove  = (e) => { const p = toWorldCoords(e.clientX, e.clientY); mouseWorld.x = p.x; mouseWorld.y = p.y; };
    const onMouseLeave = ()  => { mouseActive = false; };
    const onMouseEnter = ()  => { mouseActive = true;  };

    document.body.addEventListener('mousemove',  onMouseMove,  { passive: true });
    document.body.addEventListener('mouseleave', onMouseLeave);
    document.body.addEventListener('mouseenter', onMouseEnter);

    // ── Resize ────────────────────────────────────────────────
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize, { passive: true });

    // ── Animation loop ────────────────────────────────────────
    const clock       = new THREE.Clock();
    const smoothMouse = new THREE.Vector2(0, 0);
    let reqId;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      uniforms.uTime.value = clock.getElapsedTime();
      const tx = mouseActive ? mouseWorld.x : 0;
      const ty = mouseActive ? mouseWorld.y : 0;
      smoothMouse.x += 0.055 * (tx - smoothMouse.x);
      smoothMouse.y += 0.055 * (ty - smoothMouse.y);
      uniforms.uMouse.value.copy(smoothMouse);
      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ───────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize',      onResize);
      document.body.removeEventListener('mousemove',  onMouseMove);
      document.body.removeEventListener('mouseleave', onMouseLeave);
      document.body.removeEventListener('mouseenter', onMouseEnter);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
