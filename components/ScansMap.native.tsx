import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { buildScansMapHtml, safeJson } from './scansMapHtml';
import { parseMapEvent, type ScansMapHandle, type ScansMapProps } from './ScansMap.types';

// react-native-webview 14 declara la clase con P = undefined; se fija P para los tipos.
const WebView = RNWebView<object>;
type WebView = RNWebView<object>;

const ScansMap = forwardRef<ScansMapHandle, ScansMapProps>(function ScansMap(
  { data, selectedId, detail, point, user, layer, pad, routeStyle = 'clasica', onEvent, onError },
  ref,
) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildScansMapHtml(), []);
  const run = useCallback((js: string) => {
    web.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    zoom: d => run(`avx.zoom(${d})`),
    fit: () => run('avx.fit()'),
    flyToUser: () => { if (user) run(`avx.showUser(${user.lat},${user.lng},true)`); },
  }), [run, user]);

  useEffect(() => { if (ready) run(`avx.setLayer(${safeJson(layer)})`); }, [ready, layer, run]);
  useEffect(() => { if (ready) run(`avx.setRouteStyle(${safeJson(routeStyle)})`); }, [ready, routeStyle, run]);
  useEffect(() => { if (ready && pad) run(`avx.setPad(${safeJson(pad)})`); }, [ready, pad, run]);
  useEffect(() => { if (ready) run(`avx.setData(${safeJson(data)})`); }, [ready, data, run]);
  useEffect(() => { if (ready) run(`avx.select(${safeJson(selectedId)})`); }, [ready, selectedId, run]);
  useEffect(() => { if (ready) run(`avx.setDetail(${safeJson(detail)},true)`); }, [ready, detail, run]);
  useEffect(() => { if (ready) run(`avx.point(${safeJson(point?.kind ?? null)},${safeJson(point?.id ?? null)})`); }, [ready, point, run]);
  useEffect(() => { if (ready && user) run(`avx.showUser(${user.lat},${user.lng},false)`); }, [ready, user, run]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg?.type === 'ready') setReady(true);
            else if (msg?.type === 'error') onError?.();
            else { const e = parseMapEvent(msg); if (e) onEvent(e); }
          } catch { /* mensaje ajeno */ }
        }}
      />
    </View>
  );
});

export default ScansMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#080D10' },
  web: { flex: 1, backgroundColor: '#080D10' },
});
