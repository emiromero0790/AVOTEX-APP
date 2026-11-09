import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { buildScansMapHtml } from './scansMapHtml';
import { parseMapEvent, type ScansMapHandle, type ScansMapProps } from './ScansMap.types';

type Avx = {
  setData: (d: unknown) => void;
  select: (id: string | null) => void;
  setDetail: (d: unknown, fit: boolean) => void;
  point: (kind: string | null, id: string | null) => void;
  setLayer: (l: string) => void;
  setRouteStyle: (s: string) => void;
  zoom: (d: number) => void;
  showUser: (lat: number, lng: number, fly: boolean) => void;
  fit: () => void;
};

const ScansMap = forwardRef<ScansMapHandle, ScansMapProps>(function ScansMap(
  { data, selectedId, detail, point, user, layer, routeStyle = 'clasica', onEvent, onError },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildScansMapHtml(), []);
  const avx = () => (frame.current?.contentWindow as (Window & { avx?: Avx }) | null | undefined)?.avx;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.type === 'ready') setReady(true);
        else if (msg?.type === 'error') onError?.();
        else { const e = parseMapEvent(msg); if (e) onEvent(e); }
      } catch { /* mensaje ajeno */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEvent, onError]);

  useImperativeHandle(ref, () => ({
    zoom: d => avx()?.zoom(d),
    fit: () => avx()?.fit(),
    flyToUser: () => { if (user) avx()?.showUser(user.lat, user.lng, true); },
  }), [user]);

  useEffect(() => { if (ready) avx()?.setLayer(layer); }, [ready, layer]);
  useEffect(() => { if (ready) avx()?.setRouteStyle(routeStyle); }, [ready, routeStyle]);
  useEffect(() => { if (ready) avx()?.setData(data); }, [ready, data]);
  useEffect(() => { if (ready) avx()?.select(selectedId); }, [ready, selectedId]);
  useEffect(() => { if (ready) avx()?.setDetail(detail, true); }, [ready, detail]);
  useEffect(() => { if (ready) avx()?.point(point?.kind ?? null, point?.id ?? null); }, [ready, point]);
  useEffect(() => { if (ready && user) avx()?.showUser(user.lat, user.lng, false); }, [ready, user]);

  return (
    <iframe
      ref={frame}
      title="Mapa de mis escaneos"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#dfe7e1' }}
    />
  );
});

export default ScansMap;
