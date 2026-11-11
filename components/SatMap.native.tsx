import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { buildSatMapHtml, safeJson } from './satMapHtml';
import { isZoneId, type SatMapHandle, type SatMapProps } from './SatMap.types';

// react-native-webview 14 declara la clase con P = undefined; se fija P para los tipos.
const WebView = RNWebView<object>;
type WebView = RNWebView<object>;

const SatMap = forwardRef<SatMapHandle, SatMapProps>(function SatMap(
  { data, layer, ndvi = null, selectedZone, onSelectZone, onError },
  ref,
) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildSatMapHtml(), []);
  const run = useCallback((js: string) => {
    web.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    zoom: d => run(`avx.zoom(${d})`),
    fit: () => run('avx.fit()'),
  }), [run]);

  useEffect(() => { if (ready) run(`avx.setLayer(${safeJson(layer)})`); }, [ready, layer, run]);
  useEffect(() => { if (ready) run(`avx.setNdvi(${safeJson(ndvi)})`); }, [ready, ndvi, run]);
  useEffect(() => { if (ready && data) run(`avx.setData(${safeJson(data)});avx.select(${safeJson(selectedZone)})`); }, [ready, data, run]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) run(`avx.select(${safeJson(selectedZone)})`); }, [ready, selectedZone, run]);

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
        nestedScrollEnabled
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg?.type === 'ready') setReady(true);
            else if (msg?.type === 'select' && isZoneId(msg.id)) onSelectZone(msg.id);
            else if (msg?.type === 'clear') onSelectZone(null);
            else if (msg?.type === 'error') onError?.();
          } catch { /* mensaje ajeno */ }
        }}
      />
    </View>
  );
});

export default SatMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#0b1f17' },
  web: { flex: 1, backgroundColor: '#0b1f17' },
});
