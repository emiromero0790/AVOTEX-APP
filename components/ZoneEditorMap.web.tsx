import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { buildZoneEditorHtml, parseZoneEditorMessage, type ZoneEditorData } from './zoneEditorHtml';
import type { ZoneEditorMapHandle, ZoneEditorMapProps } from './ZoneEditorMap.types';

type Avz = { setData: (d: ZoneEditorData) => void; reject: () => void; fit: () => void; zoom: (d: number) => void };

const ZoneEditorMap = forwardRef<ZoneEditorMapHandle, ZoneEditorMapProps>(function ZoneEditorMap(
  { data, onCut, onSelect, onError },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildZoneEditorHtml(), []);
  const avz = () => (frame.current?.contentWindow as (Window & { avz?: Avz }) | null | undefined)?.avz;

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const msg = parseZoneEditorMessage(event.data);
      if (!msg) return;
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'cut') onCut({ a: msg.a, b: msg.b });
      else if (msg.type === 'select') onSelect(msg.index);
      else if (msg.type === 'error') onError?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onCut, onSelect, onError]);

  useImperativeHandle(ref, () => ({
    reject: () => avz()?.reject(),
    fit: () => avz()?.fit(),
    zoom: d => avz()?.zoom(d),
  }), []);

  useEffect(() => { if (ready) avz()?.setData(data); }, [ready, data]);

  return (
    <iframe
      ref={frame}
      title="Editor de zonas de la huerta"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#0b1f17', touchAction: 'none' }}
    />
  );
});

export default ZoneEditorMap;
