import { useEffect, useRef } from 'react';

// Mapa da rota (Leaflet via CDN — evita mexer no package-lock). Degrada em silêncio se o CDN falhar
// (a lista ordenada e o link do Google Maps seguem funcionando). Pinos numerados + traçado da rota.
type Pt = { id: string; label: string; lat: number; lng: number };
const CDN_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const CDN_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.querySelector('link[data-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN_CSS; l.setAttribute('data-leaflet', '1'); document.head.appendChild(l); }
  return new Promise((resolve, reject) => {
    const ex = document.querySelector('script[data-leaflet]') as HTMLScriptElement | null;
    if (ex) { ex.addEventListener('load', () => resolve((window as any).L)); ex.addEventListener('error', () => reject(new Error('cdn'))); return; }
    const s = document.createElement('script'); s.src = CDN_JS; s.async = true; s.setAttribute('data-leaflet', '1');
    s.onload = () => resolve((window as any).L); s.onerror = () => reject(new Error('cdn')); document.head.appendChild(s);
  });
}
const pin = (L: any, cor: string, txt: string) => L.divIcon({ className: '', html: '<div style="background:' + cor + ';color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">' + txt + '</div>', iconSize: [22, 22], iconAnchor: [11, 11] });

export function RotaMap({ origem, paradas }: { origem: { lat: number; lng: number } | null; paradas: Pt[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !ref.current) return;
      if (!mapRef.current) { mapRef.current = L.map(ref.current); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapRef.current); }
      const map = mapRef.current;
      for (const ly of layersRef.current) map.removeLayer(ly); layersRef.current = [];
      const pts: [number, number][] = [];
      if (origem) { const m = L.marker([origem.lat, origem.lng], { icon: pin(L, '#182863', 'L') }).bindPopup('Laboratório').addTo(map); layersRef.current.push(m); pts.push([origem.lat, origem.lng]); }
      paradas.forEach((p, i) => { const m = L.marker([p.lat, p.lng], { icon: pin(L, '#C5117E', String(i + 1)) }).bindPopup((i + 1) + '. ' + p.label).addTo(map); layersRef.current.push(m); pts.push([p.lat, p.lng]); });
      const linePts: [number, number][] = (origem ? [[origem.lat, origem.lng] as [number, number]] : []).concat(paradas.map((p) => [p.lat, p.lng] as [number, number]));
      if (linePts.length > 1) { const pl = L.polyline(linePts, { color: '#182863', weight: 3, opacity: 0.55 }).addTo(map); layersRef.current.push(pl); }
      if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 }); else map.setView([-15.78, -47.93], 4);
      setTimeout(() => { try { map.invalidateSize(); } catch { /* noop */ } }, 120);
    }).catch(() => { /* CDN indisponível: mapa omitido */ });
    return () => { dead = true; };
  }, [origem, paradas]);
  useEffect(() => () => { if (mapRef.current) { try { mapRef.current.remove(); } catch { /* noop */ } mapRef.current = null; } }, []);
  return <div ref={ref} style={{ height: 320, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }} />;
}
