import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { buildScansMapHtml } from './scansMapHtml';
import type { ScansMapHandle, ScansMapProps } from './ScansMap.types';

type Avx = {
  setData: (d: unknown) => void;
  select: (id: string | null, fly: boolean) => void;
  setDetail: (route: unknown, findings: unknown) => void;
  setLayer: (l: string) => void;
  zoom: (d: number) => void;
  showUser: (lat: number, lng: number, fly: boolean) => void;
  fitAll: () => void;
};

const ScansMap = forwardRef<ScansMapHandle, ScansMapProps>(function ScansMap(
  { data, selectedId, detail, user, layer, onSelect, onError },
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
        else if (msg?.type === 'select' && typeof msg.id === 'string') onSelect(msg.id);
        else if (msg?.type === 'clear') onSelect(null);
        else if (msg?.type === 'error') onError?.();
      } catch { /* mensaje ajeno */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelect, onError]);

  useImperativeHandle(ref, () => ({
    zoom: d => avx()?.zoom(d),
    flyToSelected: () => { if (selectedId) avx()?.select(selectedId, true); },
    flyToUser: () => { if (user) avx()?.showUser(user.lat, user.lng, true); },
    fitAll: () => avx()?.fitAll(),
  }), [selectedId, user]);

  useEffect(() => { if (ready) { avx()?.setData(data); avx()?.select(selectedId, false); } }, [ready, data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) avx()?.select(selectedId, true); }, [ready, selectedId]);
  useEffect(() => { if (ready) avx()?.setDetail(detail?.route ?? [], detail?.findings ?? []); }, [ready, detail]);
  useEffect(() => { if (ready && user) avx()?.showUser(user.lat, user.lng, false); }, [ready, user]);
  useEffect(() => { if (ready) avx()?.setLayer(layer); }, [ready, layer]);

  return (
    <iframe
      ref={frame}
      title="Mapa de mis escaneos"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#e5e7eb' }}
    />
  );
});

export default ScansMap;
