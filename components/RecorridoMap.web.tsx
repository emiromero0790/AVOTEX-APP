import React, { useEffect, useMemo, useRef } from 'react';
import { buildRecorridoMapHtml, RecorridoMapProps } from './recorridoMapHtml';

export type { RecorridoMapProps } from './recorridoMapHtml';

export default function RecorridoMap({ route, markers, polygon, selectedId, onSelect }: RecorridoMapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildRecorridoMapHtml({ route, markers, polygon }), [route, markers, polygon]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow) return;
      try {
        const msg = JSON.parse(String(event.data));
        if (msg?.type === 'select' && typeof msg.id === 'string') onSelect?.(msg.id);
      } catch {
        /* mensaje ajeno */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelect]);

  useEffect(() => {
    const win = ref.current?.contentWindow as (Window & { selectHallazgo?: (id: string) => void }) | null | undefined;
    if (selectedId && win?.selectHallazgo) win.selectHallazgo(selectedId);
  }, [selectedId]);

  return (
    <iframe
      ref={ref}
      title="Mapa del recorrido"
      srcDoc={html}
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
