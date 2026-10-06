import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SignupModal from '../components/SignupModal';
import FeaturedExperts from '../components/FeaturedExperts';
import { homePage } from '../content/publicPages';
import SiteSearchBox from '../components/search/SiteSearchBox';
import PricingSection from '../components/landing/pricing/PricingSection';
import SiteFooter from '../components/landing/footer/SiteFooter';
import {
  Star, Users, Briefcase, GraduationCap, TrendingUp, MessageCircle, CheckCircle,
  ArrowRight, Sparkles, Menu, X, BookOpen, Globe, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import ContactFormModal from '../components/ContactFormModal';

/* ─── Interactive 3-D Globe ──────────────────────────────────────────────── */
function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<any>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.W = canvas.offsetWidth;
      s.H = canvas.offsetHeight;
      s.cx = s.W / 2;
      s.cy = s.H / 2;
      s.R = Math.min(s.W, s.H) * 0.40;
    };

    const cities = [
      { name: 'New York', lat: 40.7, lon: -74.0, role: 'mentor' },
      { name: 'London', lat: 51.5, lon: -0.1, role: 'student' },
      { name: 'Beijing', lat: 39.9, lon: 116.4, role: 'student' },
      { name: 'Tokyo', lat: 35.7, lon: 139.7, role: 'mentor' },
      { name: 'Sydney', lat: -33.9, lon: 151.2, role: 'mentor' },
      { name: 'São Paulo', lat: -23.5, lon: -46.6, role: 'student' },
      { name: 'Mumbai', lat: 19.1, lon: 72.9, role: 'student' },
      { name: 'Nairobi', lat: -1.3, lon: 36.8, role: 'student' },
      { name: 'Toronto', lat: 43.7, lon: -79.4, role: 'mentor' },
      { name: 'Paris', lat: 48.9, lon: 2.3, role: 'mentor' },
      { name: 'Singapore', lat: 1.3, lon: 103.8, role: 'mentor' },
      { name: 'Dubai', lat: 25.2, lon: 55.3, role: 'student' },
      { name: 'Seoul', lat: 37.6, lon: 127.0, role: 'student' },
      { name: 'Chicago', lat: 41.9, lon: -87.6, role: 'mentor' },
      { name: 'Berlin', lat: 52.5, lon: 13.4, role: 'mentor' },
      { name: 'Cairo', lat: 30.0, lon: 31.2, role: 'student' },
      { name: 'Mexico City', lat: 19.4, lon: -99.1, role: 'student' },
      { name: 'Buenos Aires', lat: -34.6, lon: -58.4, role: 'student' },
      { name: 'Moscow', lat: 55.8, lon: 37.6, role: 'mentor' },
      { name: 'Bangkok', lat: 13.8, lon: 100.5, role: 'student' },
    ];

    const arcs = [
      [0, 1], [1, 4], [0, 2], [2, 3], [3, 10], [5, 0], [6, 11], [7, 1],
      [8, 1], [9, 14], [10, 12], [11, 6], [3, 13], [0, 14], [2, 15],
      [1, 18], [5, 17], [16, 0], [4, 19], [7, 2],
    ];

    const toRad = (d: number) => d * Math.PI / 180;

    const project = (lat: number, lon: number, phi: number, ss: any) => {
      const latr = toRad(lat);
      const lonr = toRad(lon) + phi;
      const x3 = Math.cos(latr) * Math.sin(lonr);
      const y3 = Math.sin(latr);
      const z3 = Math.cos(latr) * Math.cos(lonr);
      return { x: ss.cx + ss.R * x3, y: ss.cy - ss.R * y3, z: z3, visible: z3 > -0.15 };
    };

    const arcPoints = (c1: any, c2: any, phi: number, ss: any, steps = 48) => {
      const pts = [];
      const la1 = toRad(c1.lat), lo1 = toRad(c1.lon);
      const la2 = toRad(c2.lat), lo2 = toRad(c2.lon);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = la1 + (la2 - la1) * t;
        const lon = lo1 + (lo2 - lo1) * t;
        const lonr = lon + phi;
        const x3 = Math.cos(lat) * Math.sin(lonr);
        const y3 = Math.sin(lat);
        const z3 = Math.cos(lat) * Math.cos(lonr);
        pts.push({ x: ss.cx + ss.R * x3, y: ss.cy - ss.R * y3, z: z3, visible: z3 > 0 });
      }
      return pts;
    };

    s.phi = 0;
    s.dPhi = 0.003;
    s.drag = false;
    s.lastX = 0;
    s.arcProgress = arcs.map(() => Math.random());

    resize();
    window.addEventListener('resize', resize);

    const onDown = (e: any) => { s.drag = true; s.lastX = (e.touches?.[0] ?? e).clientX; };
    const onUp = () => { s.drag = false; };
    const onMove = (e: any) => {
      if (!s.drag) return;
      const x = (e.touches?.[0] ?? e).clientX;
      s.phi += (x - s.lastX) * 0.008;
      s.lastX = x;
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });

    s.landRings = [];
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => {
        const arcsData = topo.arcs;
        const tf = topo.transform;
        const scale = tf ? tf.scale : [1, 1];
        const translate = tf ? tf.translate : [0, 0];
        const decodeArc = (arcIdx: number) => {
          const raw = arcIdx < 0 ? arcsData[~arcIdx].slice().reverse() : arcsData[arcIdx].slice();
          const pts = [];
          let x = 0, y = 0;
          for (const [dx, dy] of raw) {
            x += dx; y += dy;
            pts.push([x * scale[0] + translate[0], y * scale[1] + translate[1]]);
          }
          if (arcIdx < 0) pts.reverse();
          return pts;
        };
        const buildRings = (geom: any) => {
          const rings: any[] = [];
          if (!geom) return rings;
          const processArcs = (arcsList: any[]) => { const ring: any[] = []; for (const ai of arcsList) ring.push(...decodeArc(ai)); return ring; };
          if (geom.type === 'Polygon') for (const a of geom.arcs) rings.push(processArcs(a));
          else if (geom.type === 'MultiPolygon') for (const poly of geom.arcs) for (const a of poly) rings.push(processArcs(a));
          return rings;
        };
        const stroke = 'rgba(35,60,82,0.5)';
        for (const geom of (topo.objects.countries?.geometries || [])) {
          for (const ring of buildRings(geom)) {
            if (ring.length > 2) s.landRings.push({ ring, stroke });
          }
        }
      })
      .catch(e => console.warn('Topo load failed:', e));

    const drawContinents = (phi: number) => {
      if (!s.landRings || s.landRings.length === 0) return;
      const MAX_JUMP = s.R * 0.35;
      ctx.lineWidth = 1.15;
      ctx.lineJoin = 'round';
      for (const { ring, stroke } of s.landRings) {
        const pts = ring.map(([lon, lat]: [number, number]) => {
          const latr = lat * Math.PI / 180;
          const lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          return { x: s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y: s.cy - s.R * Math.sin(latr), v: z > 0.05 };
        });
        let run: any[] = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath();
          ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = stroke;
          ctx.stroke();
          run = [];
        };
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!p.v) { flush(); continue; }
          if (run.length > 0) {
            const prev = run[run.length - 1];
            const dx = p.x - prev.x, dy = p.y - prev.y;
            if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush();
          }
          run.push(p);
        }
        flush();
      }
    };

    const drawGrid = (phi: number) => {
      const MAX_JUMP = s.R * 0.35;
      ctx.lineWidth = 0.5;
      for (let lat = -75; lat <= 75; lat += 15) {
        let run: any[] = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = 'rgba(71,85,105,0.12)'; ctx.stroke(); run = [];
        };
        for (let lon = -180; lon <= 180; lon += 3) {
          const latr = lat * Math.PI / 180, lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          if (z <= 0.05) { flush(); continue; }
          const x = s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y = s.cy - s.R * Math.sin(latr);
          if (run.length > 0) { const prev = run[run.length - 1]; const dx = x - prev.x, dy = y - prev.y; if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush(); }
          run.push({ x, y });
        }
        flush();
      }
      for (let lon = -180; lon < 180; lon += 20) {
        let run: any[] = [];
        const flush = () => {
          if (run.length < 2) { run = []; return; }
          ctx.beginPath(); ctx.moveTo(run[0].x, run[0].y);
          for (let i = 1; i < run.length; i++) ctx.lineTo(run[i].x, run[i].y);
          ctx.strokeStyle = 'rgba(71,85,105,0.12)'; ctx.stroke(); run = [];
        };
        for (let lat = -90; lat <= 90; lat += 3) {
          const latr = lat * Math.PI / 180, lonr = lon * Math.PI / 180 + phi;
          const z = Math.cos(latr) * Math.cos(lonr);
          if (z <= 0.05) { flush(); continue; }
          const x = s.cx + s.R * Math.cos(latr) * Math.sin(lonr), y = s.cy - s.R * Math.sin(latr);
          if (run.length > 0) { const prev = run[run.length - 1]; const dx = x - prev.x, dy = y - prev.y; if (Math.sqrt(dx * dx + dy * dy) > MAX_JUMP) flush(); }
          run.push({ x, y });
        }
        flush();
      }
    };

    const drawArcs = (phi: number) => {
      arcs.forEach(([i, j], idx) => {
        const c1 = cities[i], c2 = cities[j];
        const pts = arcPoints(c1, c2, phi, s);
        const speed = 0.0015 + (idx % 5) * 0.0004;
        s.arcProgress[idx] = (s.arcProgress[idx] + speed) % 1;
        const prog = s.arcProgress[idx];
        ctx.beginPath();
        let first = true;
        for (const p of pts) {
          if (!p.visible) { first = true; continue; }
          first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
          first = false;
        }
        ctx.strokeStyle = 'rgba(71,85,105,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        const dotIdx = Math.floor(prog * (pts.length - 1));
        const dp = pts[dotIdx];
        if (dp && dp.visible) {
          const trailLen = 10;
          for (let k = 0; k < trailLen; k++) {
            const ti = dotIdx - k;
            if (ti < 0) break;
            const tp = pts[ti];
            if (!tp.visible) break;
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(69,104,130,${(1 - k / trailLen) * 0.5})`;
            ctx.fill();
          }
          const grd = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, 5);
          grd.addColorStop(0, 'rgba(100,136,170,0.85)');
          grd.addColorStop(1, 'rgba(35,60,82,0)');
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
      });
    };

    /* ── Shared circle base for icons ── */
    const drawCircleBase = (cx: number, cy: number, radius: number, isMentor: boolean) => {
      const bgColor = isMentor ? '#2563eb' : '#eab308';
      const bgColorLight = isMentor ? '#3b82f6' : '#facc15';
      const borderColor = isMentor ? '#1d4ed8' : '#ca8a04';
      const shadowColor = isMentor ? 'rgba(37,99,235,0.45)' : 'rgba(234,179,8,0.45)';

      // Drop shadow glow
      const shadowGrd = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2.2);
      shadowGrd.addColorStop(0, shadowColor);
      shadowGrd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrd;
      ctx.fill();

      // Outer border ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = borderColor;
      ctx.fill();

      // Main circle background with subtle gradient
      const bgGrd = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, 0, cx, cy, radius);
      bgGrd.addColorStop(0, bgColorLight);
      bgGrd.addColorStop(1, bgColor);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = bgGrd;
      ctx.fill();

      // Specular highlight on circle
      const specGrd = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx - radius * 0.3, cy - radius * 0.3, radius * 0.7);
      specGrd.addColorStop(0, 'rgba(255,255,255,0.35)');
      specGrd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = specGrd;
      ctx.fill();
    };

    /* ── MENTOR icon: Person silhouette (no cap) — blue ── */
    const drawMentorIcon = (cx: number, cy: number, radius: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      drawCircleBase(cx, cy, radius, true);

      const c = '#ffffff';
      const r = radius;

      // Head
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.22, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Shoulders — clipped to stay inside the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.62, r * 0.58, Math.PI, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    /* ── STUDENT icon: Person with graduation cap — yellow ── */
    const drawStudentIcon = (cx: number, cy: number, radius: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      drawCircleBase(cx, cy, radius, false);

      const c = '#422006';
      const r = radius;

      // --- Mortarboard cap ---
      const capBoardY = cy - r * 0.44;
      const capW = r * 0.46;
      const capH = r * 0.1;

      // Button / top piece
      ctx.beginPath();
      ctx.rect(cx - r * 0.08, capBoardY - capH, r * 0.16, capH);
      ctx.fillStyle = c;
      ctx.fill();

      // Flat board
      ctx.beginPath();
      ctx.rect(cx - capW, capBoardY, capW * 2, capH);
      ctx.fillStyle = c;
      ctx.fill();

      // Tassel line (right side)
      ctx.beginPath();
      ctx.moveTo(cx + capW * 0.6, capBoardY + capH);
      ctx.lineTo(cx + capW * 0.6, capBoardY + capH + r * 0.2);
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(0.8, r * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Tassel ball
      ctx.beginPath();
      ctx.arc(cx + capW * 0.6, capBoardY + capH + r * 0.27, r * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Head (just below cap)
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.14, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();

      // Shoulders — clipped to stay inside the circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.6, r * 0.52, Math.PI, 0);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    const drawCities = (phi: number) => {
      const projected = cities.map(city => {
        const p = project(city.lat, city.lon, phi, s);
        return { ...city, ...p };
      }).filter(c => c.visible).sort((a, b) => a.z - b.z);

      projected.forEach(city => {
        const depth = (city.z + 1) / 2;
        const radius = 6 + depth * 7;
        const isMentor = city.role === 'mentor';
        const alpha = 0.5 + 0.5 * depth;

        if (isMentor) {
          drawMentorIcon(city.x, city.y, radius, alpha);
        } else {
          drawStudentIcon(city.x, city.y, radius, alpha);
        }
      });
    };

    const drawGlobe = () => {
      // Halo: concentric filled circles so the glow is perfectly circular (no gradient bounding box)
      const haloInner = s.R * 0.88;
      const haloOuter = s.R * 1.42;
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = haloInner + (haloOuter - haloInner) * t;
        const opacity = 0.035 * (1 - t) * (1 - t); // fade out toward outer edge
        ctx.beginPath();
        ctx.arc(s.cx, s.cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,163,184,${opacity})`;
        ctx.fill();
      }

      const atm = ctx.createRadialGradient(s.cx, s.cy, s.R * 0.85, s.cx, s.cy, s.R * 1.18);
      atm.addColorStop(0, 'rgba(71,85,105,0.05)');
      atm.addColorStop(0.6, 'rgba(71,85,105,0.02)');
      atm.addColorStop(1, 'rgba(71,85,105,0.00)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = atm;
      ctx.fill();

      const fill = ctx.createRadialGradient(s.cx - s.R * 0.3, s.cy - s.R * 0.3, s.R * 0.1, s.cx, s.cy, s.R);
      fill.addColorStop(0, 'rgba(226,232,240,0.97)');
      fill.addColorStop(0.5, 'rgba(203,213,225,0.92)');
      fill.addColorStop(1, 'rgba(148,163,184,0.85)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      const rim = ctx.createRadialGradient(s.cx, s.cy, s.R * 0.7, s.cx, s.cy, s.R);
      rim.addColorStop(0, 'transparent');
      rim.addColorStop(1, 'rgba(35,60,82,0.14)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      const spec = ctx.createRadialGradient(s.cx - s.R * 0.35, s.cy - s.R * 0.35, 0, s.cx - s.R * 0.35, s.cy - s.R * 0.35, s.R * 0.55);
      spec.addColorStop(0, 'rgba(255,255,255,0.50)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();
    };

    const clipGlobe = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, Math.PI * 2);
      ctx.clip();
    };

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, s.W, s.H);
      if (!s.drag) s.phi += s.dPhi;
      drawGlobe();
      clipGlobe();
      drawContinents(s.phi);
      drawGrid(s.phi);
      drawArcs(s.phi);
      drawCities(s.phi);
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />
  );
}

/* ─── University pool & pill layout ─────────────────────────────────────── */
const UNIVERSITIES = [
  { label: 'Oxford · UK', dot: '#10b981', border: '#d1fae5' },
  { label: 'MIT · USA', dot: '#234C6A', border: '#E8EEF4' },
  { label: 'Tsinghua · China', dot: '#f59e0b', border: '#fef3c7' },
  { label: 'Tokyo Univ · Japan', dot: '#456882', border: '#E8EEF4' },
  { label: 'Cambridge · UK', dot: '#06b6d4', border: '#cffafe' },
  { label: 'Stanford · USA', dot: '#ec4899', border: '#fce7f3' },
  { label: 'ETH Zurich · CH', dot: '#3b82f6', border: '#dbeafe' },
  { label: 'Harvard · USA', dot: '#ef4444', border: '#fee2e2' },
  { label: 'NUS · Singapore', dot: '#14b8a6', border: '#ccfbf1' },
  { label: 'Peking · China', dot: '#f59e0b', border: '#fef3c7' },
  { label: 'Imperial · UK', dot: '#64748b', border: '#e2e8f0' },
  { label: 'Caltech · USA', dot: '#f97316', border: '#ffedd5' },
  { label: 'Toronto · Canada', dot: '#0ea5e9', border: '#e0f2fe' },
  { label: 'TU Munich · Germany', dot: '#22c55e', border: '#dcfce7' },
  { label: 'KAIST · Korea', dot: '#456882', border: '#E8EEF4' },
  { label: 'IIT Bombay · India', dot: '#f43f5e', border: '#ffe4e6' },
  { label: 'Melbourne · Australia', dot: '#10b981', border: '#d1fae5' },
  { label: 'EPFL · Switzerland', dot: '#3b82f6', border: '#dbeafe' },
  { label: 'McGill · Canada', dot: '#ef4444', border: '#fee2e2' },
  { label: 'Kyoto · Japan', dot: '#456882', border: '#E8EEF4' },
  { label: 'SNU · Korea', dot: '#06b6d4', border: '#cffafe' },
  { label: 'Fudan · China', dot: '#f59e0b', border: '#fef3c7' },
  { label: 'UCL · UK', dot: '#234C6A', border: '#E8EEF4' },
  { label: 'UT Austin · USA', dot: '#f97316', border: '#ffedd5' },
  { label: 'UNSW · Australia', dot: '#14b8a6', border: '#ccfbf1' },
  { label: 'Columbia · USA', dot: '#234C6A', border: '#E8EEF4' },
  { label: 'HKU · Hong Kong', dot: '#22c55e', border: '#dcfce7' },
  // Additional engineering schools with short labels
  { label: 'UIUC · USA', dot: '#3b82f6', border: '#dbeafe' },        // Univ. of Illinois Urbana-Champaign
  { label: 'KTH · Sweden', dot: '#06b6d4', border: '#cffafe' },      // KTH Royal Institute of Technology
  { label: 'UCB · USA', dot: '#f97316', border: '#ffedd5' },         // UC Berkeley
  { label: 'UCLA · USA', dot: '#0ea5e9', border: '#e0f2fe' },        // UCLA
  { label: 'Georgia Tech · USA', dot: '#fbbf24', border: '#fef3c7' },
  { label: 'NTU · Singapore', dot: '#22c55e', border: '#dcfce7' },   // Nanyang Technological Univ.
  { label: 'HKUST · Hong Kong', dot: '#6366f1', border: '#e0e7ff' },
  { label: 'PoliMi · Italy', dot: '#2563eb', border: '#dbeafe' },    // Politecnico di Milano
  { label: 'UTokyo · Japan', dot: '#0f766e', border: '#ccfbf1' },    // Univ. of Tokyo short
  { label: 'RWTH · Germany', dot: '#4f46e5', border: '#e0e7ff' },    // RWTH Aachen
];

const PILL_POSITIONS = [
  'top-[30%] -left-3',
  // move closer to the globe instead of hugging the right edge
  'top-[24%] left-[68%]',
  'top-[62%] -left-3',
  'top-[52%] right-4',
];

// Each pill starts at a different offset so they always show distinct universities
const PILL_STARTS = [0, 9, 18, 27];
// Each pill advances by a different step; we also enforce uniqueness per frame
const PILL_STEPS = [5, 7, 9, 11];
// Slightly different cycle intervals so pills don't all swap at once
const PILL_CYCLES = [7000, 8200, 7600, 9000];

export default function TOEConsulting() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [pills, setPills] = useState(
    PILL_STARTS.map(startIdx => ({ uniIdx: startIdx, shown: false, fading: false }))
  );

  const statsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const guidelinesRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const expertsRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  const sectionRefs = [statsRef, aboutRef, servicesRef, guidelinesRef, successRef, expertsRef, pricingRef];

  const getCurrentSectionIndex = () => {
    const viewportTop = window.scrollY + 100;
    let current = -1;
    sectionRefs.forEach((ref, i) => {
      const el = ref.current;
      if (el && el.getBoundingClientRect) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= viewportTop) current = i;
      }
    });
    return current;
  };

  const scrollToNextSection = () => {
    const idx = getCurrentSectionIndex();
    const next = Math.min(idx + 1, sectionRefs.length - 1);
    sectionRefs[next].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToPrevSection = () => {
    const idx = getCurrentSectionIndex();
    if (idx <= 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    sectionRefs[idx - 1].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [showScrollDown, setShowScrollDown] = useState(true);
  const [showScrollUp, setShowScrollUp] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setShowScrollDown(docHeight <= 100 || y < docHeight - 150);
      setShowScrollUp(y > window.innerHeight * 0.5);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    const t = setTimeout(onScroll, 400);
    const t2 = setTimeout(onScroll, 1200);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => { setActiveTestimonial((prev) => (prev + 1) % testimonials.length); }, 5000);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    // Staggered pill reveal + cycling
    const allTimers: any[] = [];
    PILL_STARTS.forEach((_, i) => {
      const revealAt = 800 + i * 1300;
      // Initial reveal
      allTimers.push(setTimeout(() => {
        setPills(prev => prev.map((p, idx) => idx === i ? { ...p, shown: true } : p));
        // Start cycling after reveal settles
        const cycleId = setInterval(() => {
          // Fade out this pill
          setPills(prev => prev.map((p, idx) => idx === i ? { ...p, fading: true } : p));
          // Swap university after fade, making sure no two pills show the same uni at once
          const swapId = setTimeout(() => {
            setPills(prev => {
              const usedByOthers = prev
                .map((p, idx) => (idx === i ? null : p.uniIdx))
                .filter(v => v !== null);
              let next = (prev[i].uniIdx + PILL_STEPS[i]) % UNIVERSITIES.length;
              let guard = 0;
              while (usedByOthers.includes(next) && guard < UNIVERSITIES.length) {
                next = (next + 1) % UNIVERSITIES.length;
                guard += 1;
              }
              return prev.map((p, idx) =>
                idx === i ? { ...p, uniIdx: next, fading: false } : p
              );
            });
          }, 380);
          allTimers.push(swapId);
        }, PILL_CYCLES[i]);
        allTimers.push(cycleId);
      }, revealAt));
    });
    return () => { clearInterval(interval); window.removeEventListener('scroll', handleScroll); allTimers.forEach(id => { clearTimeout(id); clearInterval(id); }); };
  }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => { setMobileMenuOpen(false); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const openContact = () => { setMobileMenuOpen(false); setShowContactModal(true); };

  const services = [
    { icon: <GraduationCap className="w-8 h-8" />, title: "Study Abroad", description: "Navigate applications, program fit, and admissions strategy with faculty who know top programs abroad.", topics: ["Program selection", "Application materials", "Scholarship planning"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
    { icon: <Briefcase className="w-8 h-8" />, title: "Work Abroad", description: "Understand job markets, employer expectations, and relocation steps with professionals who have done it.", topics: ["Job search abroad", "CV & interviews", "Relocation basics"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
    { icon: <BookOpen className="w-8 h-8" />, title: "Research Guidance", description: "Sharpen your research direction, methods, and publications with experienced researchers in your field.", topics: ["Research design", "Writing & review", "Lab and funding paths"], color: "from-[#F8FAFC] to-white", accent: "text-[#234C6A]", border: "border-slate-200 hover:border-[#456882]", iconBg: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  const testimonials = [
    { name: "Sarah Chen", role: "PhD Student, Stanford", content: "The guidance I received helped me get into my dream program. My advisor reviewed my research proposal and gave invaluable feedback.", rating: 5, image: "SC", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Michael Rodriguez", role: "Senior Engineer, Google", content: "Talking with an expert in my field gave me the clarity I needed for my career transition. Worth every minute.", rating: 5, image: "MR", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Dr. Yuki Tanaka", role: "Research Scientist", content: "As an expert on the platform, I've connected with brilliant minds globally and found exceptional graduate students for my lab.", rating: 5, image: "YT", color: "bg-[#E8EEF4] text-[#234C6A]" },
    { name: "Ahmed Hassan", role: "MBA Graduate", content: "The work abroad guidance clarified markets and interviews for me. I landed three offers within two months.", rating: 5, image: "AH", color: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  const expertBenefits = [
    "Monetize your knowledge and expertise for societal impact",
    "Direct recruitment pipeline for top graduate students",
    "Expand your global network and perspectives",
    "Flexible scheduling that fits your lifestyle",
    "Conduct seminars and workshops to share your insights with a wider audience",
  ];

  const stats = [
    { number: "500+", label: "Expert Consultants", icon: <Users className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "10K+", label: "Consultations Done", icon: <MessageCircle className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "4.9/5", label: "Average Rating", icon: <Star className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
    { number: "100+", label: "Countries Served", icon: <Globe className="w-6 h-6" />, color: "bg-[#E8EEF4] text-[#234C6A]" },
  ];

  return (
    <div className="min-h-screen text-slate-900 overflow-x-hidden" style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC' }}>
      {showContactModal && <ContactFormModal onClose={() => setShowContactModal(false)} />}
      {showSignupModal && <SignupModal onClose={() => setShowSignupModal(false)} onGoLogin={() => { setShowSignupModal(false); navigate('/login'); }} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700;800&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-stat-inter { font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); } 33% { transform: translateY(-12px) rotate(1deg); } 66% { transform: translateY(-6px) rotate(-1deg); } }
        @keyframes pillReveal { 0% { opacity: 0; transform: scale(0.72) translateY(14px); } 65% { opacity: 1; transform: scale(1.05) translateY(-3px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .hero-headline-gradient {
          background: linear-gradient(135deg, #1B3C53 0%, #234C6A 40%, #456882 70%, #D9EAFD 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: block;
        }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        .animate-fade-up { animation: fadeUp 0.8s ease-out both; }
        .animate-fade-in { animation: fadeIn 0.6s ease-out both; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-soft { animation: pulse-soft 3s ease-in-out infinite; }
        .hero-grid {
          background-image: linear-gradient(rgba(188,204,220,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(188,204,220,0.22) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 20px 60px -10px rgba(0,0,0,0.15); }
        .page-dots {
          background-image: radial-gradient(circle, rgba(148,163,184,0.55) 1.7px, transparent 1.7px);
          background-size: 26px 26px;
        }
        .page-dots-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(circle, rgba(148,163,184,0.55) 1.7px, transparent 1.7px);
          background-size: 26px 26px;
          opacity: 0.65;
        }
        .page-dots-layer--animated {
          animation: dotsFade 4s ease-in-out infinite;
        }
        @keyframes dotsFade {
          0%, 100% { opacity: 0.10; }
          50% { opacity: 0.65; }
        }
        .auth-dots-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-color: #F8FAFC;
          background-image: radial-gradient(circle, rgba(188,204,220,0.45) 1.8px, transparent 1.8px);
          background-size: 28px 28px;
          opacity: 0.65;
        }
        .auth-dots-layer--animate {
          animation: authDotsDrift 35s linear infinite;
        }
        @keyframes authDotsDrift {
          0% { background-position: 0 0; }
          100% { background-position: 28px 28px; }
        }
        .nav-link { position: relative; }
        .nav-link::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 2px; background: #9AA6B2; transition: width 0.3s ease; }
        .nav-link:hover::after { width: 100%; }
        .gradient-text { background: linear-gradient(135deg, #1B3C53 0%, #234C6A 45%, #456882 75%, #D9EAFD 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-blob { background: radial-gradient(ellipse at center, rgba(156,173,189,0.32) 0%, transparent 70%); filter: blur(40px); }
        .hero-blob-2 { background: radial-gradient(ellipse at center, rgba(26,53,72,0.35) 0%, transparent 70%); filter: blur(50px); }
        .section-label { letter-spacing: 0.15em; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
        .btn-primary { background: linear-gradient(135deg, #234C6A, #456882); transition: all 0.3s ease; }
        .btn-primary:hover { background: linear-gradient(135deg, #1B3C53, #234C6A); box-shadow: 0 12px 40px rgba(26,53,72,0.38); transform: translateY(-1px); }
        .about-highlight { background: linear-gradient(135deg, #F8FAFC, #F0F4F8); border-left: 4px solid #9AA6B2; }
        .footer-bg { background: #1B3C53; }
      `}</style>

      {/* NAV */}
      <header
        data-wl-header
        className={`fixed left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-[#F8FAFC]/95 backdrop-blur-md shadow-sm border-b border-[#BCCCDC]' : 'bg-[#F8FAFC]/80 backdrop-blur-sm'}`}
        style={{ top: 'var(--wl-banner-offset, 0px)' }}
      >
        <div className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 sm:h-[4.5rem] lg:px-8 2xl:px-12">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex shrink-0 items-center gap-3 group"
          >
            <img src="/logos/main_gold_blue.svg" alt="WisdomLinked" className="h-10 w-auto max-w-[200px] object-contain object-left" />
            <div className="leading-none">
              <div className="font-display font-bold text-[1.35rem] text-slate-900">WisdomLinked</div>
            </div>
          </button>

          <div className="hidden min-w-0 items-center justify-center gap-4 lg:flex xl:gap-5 2xl:gap-6">
            <nav className="flex shrink-0 items-center gap-4 xl:gap-5 2xl:gap-6" aria-label="Main">
              {([["About Us", () => scrollTo(aboutRef)], ["Services", () => scrollTo(servicesRef)], ["Guidelines", () => scrollTo(guidelinesRef)], ["Pricing", () => scrollTo(pricingRef)], ["Resources", () => navigate('/resources')], ["Contact Us", openContact]] as const).map(([label, action]) => (
                <button key={label as string} type="button" onClick={action as () => void} className="nav-link whitespace-nowrap text-sm font-semibold tracking-wide text-slate-900 transition-colors hover:text-[#234C6A]">{label}</button>
              ))}
            </nav>
            <div className="min-w-[220px] max-w-[380px] flex-1 xl:min-w-[260px] xl:max-w-[440px]">
              <SiteSearchBox
                audience="public"
                variant="nav"
                showShortcutHint
                placeholder="Search mentors, universities, or topics"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            <div className="hidden items-center gap-3 lg:flex">
              <button type="button" onClick={() => navigate('/login')} className="h-10 px-5 rounded-full border border-[#BCCCDC] text-slate-900 hover:border-[#9AA6B2] hover:text-[#234C6A] transition-all text-sm font-semibold bg-white/85">Login</button>
              <button type="button" onClick={() => setShowSignupModal(true)} className="btn-primary h-10 px-5 rounded-full text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]">Sign Up</button>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
                aria-label={mobileSearchOpen ? 'Close search' : 'Open search'}
                aria-expanded={mobileSearchOpen}
                onClick={() => {
                  setMobileSearchOpen(open => !open);
                  setMobileMenuOpen(false);
                }}
              >
                <Search className="h-[18px] w-[18px]" aria-hidden />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#234C6A]/40"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => {
                  setMobileMenuOpen(v => !v);
                  setMobileSearchOpen(false);
                }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5 text-slate-600" /> : <Menu className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div className="border-t border-[#BCCCDC] bg-[#F8FAFC] px-6 py-3 lg:hidden">
            <SiteSearchBox
              audience="public"
              variant="nav"
              autoFocus
              placeholder="Search mentors, universities, or topics"
            />
          </div>
        ) : null}

        {mobileMenuOpen ? (
          <div className="space-y-3 border-t border-[#BCCCDC] bg-[#F8FAFC] px-6 py-4 lg:hidden">
            {([["About Us", () => { setMobileMenuOpen(false); scrollTo(aboutRef); }], ["Services", () => { setMobileMenuOpen(false); scrollTo(servicesRef); }], ["Guidelines", () => { setMobileMenuOpen(false); scrollTo(guidelinesRef); }], ["Pricing", () => { setMobileMenuOpen(false); scrollTo(pricingRef); }], ["Resources", () => { setMobileMenuOpen(false); navigate('/resources'); }], ["Contact Us", () => { setMobileMenuOpen(false); openContact(); }]] as const).map(([label, action]) => (
              <button key={label as string} type="button" onClick={action as () => void} className="block w-full py-1 text-left font-semibold text-slate-700 transition-colors hover:text-[#234C6A]">{label}</button>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} className="flex-1 py-2.5 rounded-full border border-slate-300 text-sm font-semibold text-slate-700">Login</button>
              <button type="button" onClick={() => { setMobileMenuOpen(false); setShowSignupModal(true); }} className="flex-1 py-2.5 btn-primary rounded-full text-sm font-semibold text-white">Sign Up</button>
            </div>
          </div>
        ) : null}
      </header>

      {/* Scroll down — right bottom, next section */}
      {showScrollDown && (
        <button
          type="button"
          onClick={scrollToNextSection}
          className="fixed bottom-6 right-5 z-[60] w-11 h-11 rounded-full bg-white border-2 border-slate-200 shadow-xl flex items-center justify-center text-[#234C6A] hover:bg-[#E8EEF4] hover:border-[#456882] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#234C6A]/50"
          aria-label="Scroll to next section"
        >
          <ChevronDown className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}

      {/* Scroll up — right bottom, above scroll down */}
      {showScrollUp && (
        <button
          type="button"
          onClick={scrollToPrevSection}
          className="fixed bottom-20 right-5 z-[60] w-11 h-11 rounded-full bg-white border-2 border-slate-200 shadow-xl flex items-center justify-center text-[#234C6A] hover:bg-[#E8EEF4] hover:border-[#456882] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#234C6A]/50"
          aria-label="Scroll up"
        >
          <ChevronUp className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}

      <>
        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex items-center overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>

          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />

          <div className="absolute -top-40 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(156,173,189,0.32) 0%, transparent 65%)', filter: 'blur(70px)' }}></div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full pt-24 sm:pt-28 pb-12 sm:pb-20 grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-0 items-center min-h-screen">

            {/* ── LEFT: Copy column ── */}
            <div className={`relative z-10 lg:pr-14 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

              <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-2 rounded-full bg-white/80 border border-[#BCCCDC] shadow-sm animate-fade-in" style={{ animationDelay: '0.05s', boxShadow: '0 1px 3px rgba(35,60,82,0.08)' }}>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#234C6A' }}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#234C6A' }}></span>
                </span>
                <span className="text-[11px] font-bold tracking-[0.13em] uppercase" style={{ color: '#234C6A' }}>500+ Active Experts · 100+ Countries</span>
              </div>

              <h1 className="font-display font-bold leading-[1.12] mb-6 animate-fade-up text-slate-900" style={{ animationDelay: '0.15s', fontSize: 'clamp(2.15rem, 4.2vw, 3.35rem)' }}>
                {homePage.hero.titleLead}{' '}
                <span className="whitespace-nowrap">{homePage.hero.titleAccent}</span>
              </h1>

              <p className="text-slate-500 leading-relaxed mb-6 sm:mb-9 max-w-[520px] animate-fade-up text-sm sm:text-base" style={{ animationDelay: '0.28s' }}>
                {homePage.hero.snippet}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 items-start mb-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
                <button onClick={() => setShowSignupModal(true)} className="group btn-primary px-8 py-4 rounded-2xl font-semibold text-white flex items-center gap-2.5 shadow-xl text-[0.9375rem]" style={{ boxShadow: '0 10px 40px rgba(35,60,82,0.25)' }}>
                  Book a Consultation
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </button>
                <button onClick={() => navigate('/expertregister')} className="px-8 py-4 rounded-2xl border-2 border-slate-200 bg-white/70 backdrop-blur-sm text-slate-700 font-semibold text-[0.9375rem] hover:border-[#456882] hover:text-[#234C6A] hover:bg-white transition-all duration-300">
                  Become an Expert
                </button>
              </div>

              <div className="flex items-center gap-5 mb-10 animate-fade-up" style={{ animationDelay: '0.52s' }}>
                <div className="flex -space-x-3">
                  {[
                    { i: 'SC', bg: '#E8EEF4', fg: '#234C6A' }, { i: 'MR', bg: '#E8EEF4', fg: '#234C6A' },
                    { i: 'YT', bg: '#E8EEF4', fg: '#234C6A' }, { i: 'AH', bg: '#E8EEF4', fg: '#234C6A' },
                    { i: 'KL', bg: '#E8EEF4', fg: '#234C6A' },
                  ].map(({ i, bg, fg }, idx) => (
                    <div key={idx} className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold shadow-sm"
                      style={{ background: bg, color: fg }}>{i}</div>
                  ))}
                  <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: '#234C6A' }}>+9K</div>
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">{[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-xs text-slate-500">Trusted by <span className="font-bold text-slate-800">10,000+</span> clients worldwide</p>
                </div>
              </div>

              <div className="mt-14 hidden lg:flex animate-fade-up" style={{ animationDelay: '0.72s' }}>
                <button onClick={() => scrollTo(aboutRef)} className="flex items-center gap-2 text-slate-400 hover:text-[#234C6A] transition-colors group">
                  <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform animate-pulse-soft" />
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase">Explore</span>
                </button>
              </div>
            </div>

            {/* ── RIGHT: Visual panel ── */}
            <div className={`relative flex items-center justify-center transition-all duration-1200 delay-150 min-h-[min(70vh,520px)] sm:min-h-[600px] lg:min-h-[820px] ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] rounded-full"
                  style={{ background: 'radial-gradient(ellipse, rgba(35,60,82,0.18) 0%, rgba(69,104,130,0.08) 45%, transparent 70%)', filter: 'blur(32px)' }}></div>
              </div>

              <div className="relative w-full max-w-[min(660px,95vw)] aspect-square drop-shadow-2xl">
                <GlobeCanvas />
              </div>



              {/* Drag hint */}
              <div className="absolute bottom-2 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/85 backdrop-blur-sm border border-slate-200 rounded-full px-3 sm:px-4 py-1.5 z-20 pointer-events-none select-none shadow-sm">
                <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l7-7 7 7M5 15l7 7 7-7" /></svg>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold">Drag to rotate</span>
              </div>

              {/* Floating university pills — pool of 27, cycling independently; hidden on very small screens to avoid clutter */}
              {PILL_POSITIONS.map((cls, i) => {
                const { uniIdx, shown, fading } = pills[i];
                const uni = UNIVERSITIES[uniIdx];
                return (
                  <div key={i} className={`absolute ${cls} z-10 hidden sm:block`}
                    style={{
                      opacity: shown ? 1 : 0,
                      transform: shown ? 'scale(1) translateY(0)' : 'scale(0.78) translateY(14px)',
                      transition: 'opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)',
                    }}>
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-3.5 py-2.5 shadow-lg"
                      style={{
                        border: `1px solid ${uni.border}`,
                        animation: shown ? 'float 10s ease-in-out infinite' : 'none',
                        opacity: fading ? 0 : 1,
                        transition: 'opacity 0.38s ease, border-color 0.38s ease',
                      }}>
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: uni.dot }}></span>
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: uni.dot }}></span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{uni.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section ref={statsRef} className="relative py-16 px-6 border-y border-slate-200 scroll-mt-20" style={{ backgroundColor: '#F0F4F8' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="text-center card-hover p-4 sm:p-6 rounded-2xl border border-slate-200" style={{ backgroundColor: '#F8FAFC' }}>
                  <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 mb-2 sm:mb-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-1 font-stat-inter tabular-nums">{stat.number}</div>
                  <div className="text-slate-500 text-sm font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section ref={aboutRef} className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div>
                <div className="inline-block section-label text-[#234C6A] mb-4">About Us</div>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-tight">{homePage.connect.titleLead} <span style={{ color: '#234C6A' }}>{homePage.connect.titleAccent}</span></h2>
                <p className="text-slate-600 text-lg leading-relaxed mb-4">{homePage.connect.snippet}</p>
                <p className="text-slate-600 text-lg leading-relaxed mb-6">The business draws on the talents of elite professionals — mostly top-notch professors, scientists, researchers and other successful professionals. These elite professionals all have their graduate degrees, mostly Ph.D., with decades of successful experiences.</p>
                <div className="about-highlight rounded-r-xl p-5 mb-6">
                  <p className="text-slate-600 text-lg leading-relaxed">A 30-minute conversation with an authoritative expert through this platform could save clients years or months of effort — or countless dollars that could otherwise be wasted in darkness.</p>
                </div>
                <button onClick={openContact} className="px-6 py-3 rounded-full btn-primary text-white font-semibold text-sm shadow-md shadow-[#BCCCDC]">Contact Us</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:pt-12">
                {[
                  { emoji: "🎓", title: "Who are our clients?", text: "People planning to go abroad for graduate studies, people looking for a job in the western world, and researchers seeking insightful advice with their research efforts.", color: "border-slate-200", bg: "#F8FAFC" },
                  { emoji: "🏆", title: "How do our experts join?", text: "Talents sign on a volunteer basis, providing available time slots for consulting at an asking price of their choice. It's flexible, impactful, and community-driven.", color: "border-slate-200", bg: "#F8FAFC" },
                  { emoji: "📅", title: "How does booking work?", text: "Clients prepay for a time slot at the asking price plus a client-determined tip (zero or more) before an appointment is made.", color: "border-slate-200", bg: "#F8FAFC" },
                  { emoji: "🎥", title: "How do sessions run?", text: "At the time of an appointment, the expert and client converse via video or audio depending on agreed choices. Conversations may be recorded for quality control.", color: "border-slate-200", bg: "#F8FAFC" },
                  { emoji: "💬", title: "Forms of communication", text: "Customers may propose or accept a 1-1 appointment with an expert or join an expert-led seminar.", color: "border-slate-200", bg: "#F8FAFC" },
                  { emoji: "📖", title: "User's Guide", text: "The HelpBot after login can answer FAQs like 'How to initiate a 1-1 appointment with an expert'.", color: "border-slate-200", bg: "#F8FAFC" },
                ].map((item, i) => (
                  <div key={i} className={`card-hover p-5 rounded-2xl border ${item.color} flex gap-4 items-start`} style={{ background: 'linear-gradient(135deg, rgba(69,104,130,0.06) 0%, rgba(69,104,130,0.04) 100%), #F0F4F8' }}>
                    <span className="text-2xl mt-0.5 shrink-0">{item.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 mb-1">{item.title}</div>
                      <p className="text-slate-700 text-sm leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section ref={servicesRef} className="relative py-28 px-6 scroll-mt-20" style={{ backgroundColor: '#F0F4F8' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block section-label text-[#234C6A] mb-4">Our Services</div>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-4">{homePage.advice.title}</h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">{homePage.advice.snippet}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 items-stretch">
              {services.map((service, index) => (
                <div key={index} className={`card-hover p-6 sm:p-8 rounded-2xl sm:rounded-3xl border ${service.border} group cursor-pointer flex flex-col min-h-0`} style={{ background: 'linear-gradient(135deg, rgba(69,104,130,0.05) 0%, rgba(69,104,130,0.10) 100%), #F0F4F8' }}>
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 mb-4 sm:mb-6 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300 text-[#234C6A]" style={{ backgroundColor: 'rgba(69,104,130,0.12)' }}>{service.icon}</div>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">{service.title}</h3>
                    <p className="text-slate-500 mb-5 leading-relaxed text-sm">{service.description}</p>
                    <div className="space-y-2">
                      {service.topics.map((topic, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${service.accent}`} />{topic}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setShowSignupModal(true)} className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all group-hover:gap-2.5 shrink-0" style={{ background: 'linear-gradient(135deg, #234C6A 0%, #456882 100%)' }}>
                    Start now <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GUIDELINES */}
        <section ref={guidelinesRef} className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="text-left mb-8 sm:mb-10">
              <div className="inline-block section-label text-[#234C6A] mb-4">Guidelines</div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                {homePage.guidelines.title}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                {homePage.guidelines.snippet}
              </p>
            </div>
            <div className="space-y-6">
              {[
                { emoji: "📜", title: "Basic rule", text: "Users must comply with all applicable laws, provide truthful information, and agree to WisdomLinked's rules and agreements.", color: "border-[#BCCCDC]" },
                { emoji: "💳", title: "Appointments & Payments", text: "Our platform operates on an appointment-only basis and does not offer on-demand or real-time services. An appointment is confirmed once the client has submitted payment at the expert's listed rate, plus any applicable gratuity. If the client fails to attend the scheduled appointment, the payment is non-refundable. If the expert fails to attend, the client is entitled to a full refund.", color: "border-[#BCCCDC]" },
                { emoji: "📋", title: "Complaints & Resolution", text: "Clients may submit a complaint in the event of service-related issues, including but not limited to expert tardiness, platform technical difficulties, or unsatisfactory service quality. Our team will review each complaint and make every effort to respond within five (5) business days.", color: "border-[#BCCCDC]" },
              ].map((item, i) => (
                <div key={i} className={`card-hover p-5 md:p-6 rounded-2xl border ${item.color} flex gap-4 items-start`} style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F8FAFC' }}>
                  <span className="text-2xl mt-0.5">{item.emoji}</span>
                  <div>
                    <div className="font-semibold text-slate-800 mb-2 text-lg">{item.title}</div>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FeaturedExperts onViewAll={() => setShowSignupModal(true)} />

        {/* TESTIMONIALS */}
        <section ref={successRef} className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 scroll-mt-20" style={{ backgroundColor: '#F8FAFC' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-16">
              <div className="inline-block section-label text-[#234C6A] mb-4">Success Stories</div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4">{homePage.community.title}</h2>
              <p className="text-slate-600 text-base sm:text-lg">{homePage.community.snippet}</p>
            </div>
            <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200 p-6 sm:p-10 md:p-16 overflow-hidden min-h-[280px] sm:min-h-[320px] flex items-center" style={{ background: 'linear-gradient(135deg, #F0F4F8 0%, #E8EEF4 100%)' }}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-60" style={{ background: 'radial-gradient(circle, rgba(35,60,82,0.12) 0%, transparent 70%)' }}></div>
              {testimonials.map((testimonial, index) => (
                <div key={index} className={`absolute inset-0 p-6 sm:p-10 md:p-16 flex items-center transition-all duration-700 ${index === activeTestimonial ? 'opacity-100 translate-x-0' : index < activeTestimonial ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'}`}>
                  <div className="text-center w-full">
                    <div className={`inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-4 sm:mb-5 rounded-xl sm:rounded-2xl ${testimonial.color} text-base sm:text-lg font-bold`}>{testimonial.image}</div>
                    <div className="flex justify-center gap-1 mb-4 sm:mb-5">{[...Array(testimonial.rating)].map((_, i) => <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" />)}</div>
                    <p className="font-display text-lg sm:text-xl md:text-2xl text-slate-700 mb-4 sm:mb-6 leading-relaxed italic max-w-2xl mx-auto px-1">"{testimonial.content}"</p>
                    <div><div className="font-bold text-slate-900">{testimonial.name}</div><div className="text-slate-500 text-sm mt-1">{testimonial.role}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button key={index} onClick={() => setActiveTestimonial(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${index === activeTestimonial ? 'bg-[#234C6A] w-8' : 'bg-slate-300 w-2 hover:bg-slate-400'}`} />
              ))}
            </div>
          </div>
        </section>

        {/* JOIN AS EXPERT */}
        <section ref={expertsRef} className="relative py-16 sm:py-20 md:py-28 px-4 sm:px-6 scroll-mt-20" style={{ backgroundColor: '#F0F4F8' }}>
          <div className="page-dots-layer page-dots-layer--animated" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <div className="inline-block section-label text-[#234C6A] mb-4">For Experts</div>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-4 sm:mb-6 leading-tight">{homePage.impact.titleLead} <span style={{ color: '#234C6A' }}>{homePage.impact.titleAccent}</span></h2>
                <p className="text-slate-600 text-lg mb-8 leading-relaxed">{homePage.impact.snippet}</p>
                <div className="space-y-3 mb-8">
                  {expertBenefits.map((benefit, index) => (
                    <div key={index} className="card-hover flex items-start gap-4 p-4 rounded-xl border border-slate-200" style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F0F4F8' }}>
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#234C6A' }} />
                      <span className="text-slate-700 font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/expertregister')} className="group btn-primary px-8 py-4 rounded-full font-semibold text-white text-base flex items-center gap-2 shadow-lg shadow-[#BCCCDC]">
                  Apply to Become an Expert <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  { icon: <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#234C6A' }} />, title: "PhD+", sub: "Required Credential", border: "border-slate-200" },
                  { icon: <Globe className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#234C6A' }} />, title: "Global", sub: "Network Reach", border: "border-slate-200" },
                  { icon: <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#234C6A' }} />, title: "Flexible", sub: "Your Schedule", border: "border-slate-200" },
                  { icon: <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#234C6A' }} />, title: "Impact", sub: "Make a Difference", border: "border-slate-200" },
                ].map((item, i) => (
                  <div key={i} className={`card-hover p-4 sm:p-6 rounded-xl sm:rounded-2xl border ${item.border}`} style={{ background: 'linear-gradient(rgba(69,104,130,0.06), rgba(69,104,130,0.06)), #F0F4F8' }}>
                    {item.icon}
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 sm:mt-3 mb-1 font-display">{item.title}</div>
                    <div className="text-slate-500 text-xs sm:text-sm">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRICING / HOW IT WORKS */}
        <PricingSection sectionRef={pricingRef} onBrowseExperts={() => setShowSignupModal(true)} />

        {/* FOOTER */}
        <SiteFooter onContact={openContact} />
      </>
    </div>
  );
}
