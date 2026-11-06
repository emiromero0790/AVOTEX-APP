import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { buildSatMapHtml } from './satMapHtml';
import { isZoneId, type SatMapHandle, type SatMapProps } from './SatMap.types';

type Avx = {
  setData: (d: unknown) => void;
  setLayer: (l: string) => void;
  select: (id: string | null) => void;
  zoom: (d: number) => void;
  fit: () => void;
};

const SatMap = forwardRef<SatMapHandle, SatMapProps>(function SatMap(
  { data, layer, selectedZone, onSelectZone, onError },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildSatMapHtml(), []);
  const avx = () => (frame.current?.contentWindow as (Window & { avx?: Avx }) | null | undefined)?.avx;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.type === 'ready') setReady(true);
        else if (msg?.type === 'select' && isZoneId(msg.id)) onSelectZone(msg.id);
        else if (msg?.type === 'clear') onSelectZone(null);
        else if (msg?.type === 'error') onError?.();
      } catch { /* mensaje ajeno */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelectZone, onError]);

  useImperativeHandle(ref, () => ({
    zoom: d => avx()?.zoom(d),
    fit: () => avx()?.fit(),
  }), []);

  useEffect(() => { if (ready) avx()?.setLayer(layer); }, [ready, layer]);
  useEffect(() => { if (ready && data) { avx()?.setData(data); avx()?.select(selectedZone); } }, [ready, data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) avx()?.select(selectedZone); }, [ready, selectedZone]);

  return (
    <iframe
      ref={frame}
      title="Mapa satelital de la huerta"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#0b1f17' }}
    />
  );
});

export default SatMap;
