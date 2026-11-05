import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { buildScansMapHtml, safeJson } from './scansMapHtml';
import type { ScansMapHandle, ScansMapProps } from './ScansMap.types';

// react-native-webview 14 declara la clase con P = undefined; se fija P para los tipos.
const WebView = RNWebView<object>;
type WebView = RNWebView<object>;

const ScansMap = forwardRef<ScansMapHandle, ScansMapProps>(function ScansMap(
  { data, selectedId, detail, user, layer, onSelect, onError },
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
    flyToSelected: () => { if (selectedId) run(`avx.select(${safeJson(selectedId)},true)`); },
    flyToUser: () => { if (user) run(`avx.showUser(${user.lat},${user.lng},true)`); },
    fitAll: () => run('avx.fitAll()'),
  }), [run, selectedId, user]);

  useEffect(() => { if (ready) run(`avx.setData(${safeJson(data)});avx.select(${safeJson(selectedId)},false)`); }, [ready, data, run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) run(`avx.select(${safeJson(selectedId)},true)`); }, [ready, selectedId, run]);
  useEffect(() => { if (ready) run(`avx.setDetail(${safeJson(detail?.route ?? [])},${safeJson(detail?.findings ?? [])})`); }, [ready, detail, run]);
  useEffect(() => { if (ready && user) run(`avx.showUser(${user.lat},${user.lng},false)`); }, [ready, user, run]);
  useEffect(() => { if (ready) run(`avx.setLayer(${safeJson(layer)})`); }, [ready, layer, run]);

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
            else if (msg?.type === 'select' && typeof msg.id === 'string') onSelect(msg.id);
            else if (msg?.type === 'clear') onSelect(null);
            else if (msg?.type === 'error') onError?.();
          } catch { /* mensaje ajeno */ }
        }}
      />
    </View>
  );
});

export default ScansMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#06120b' },
  web: { flex: 1, backgroundColor: '#06120b' },
});
