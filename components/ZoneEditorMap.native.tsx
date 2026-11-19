import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { safeJsonValue as safeJson } from './safeJson';
import { buildZoneEditorHtml, parseZoneEditorMessage } from './zoneEditorHtml';
import type { ZoneEditorMapHandle, ZoneEditorMapProps } from './ZoneEditorMap.types';

// react-native-webview 14 declara la clase con P = undefined; se fija P para los tipos.
const WebView = RNWebView<object>;
type WebView = RNWebView<object>;

const ZoneEditorMap = forwardRef<ZoneEditorMapHandle, ZoneEditorMapProps>(function ZoneEditorMap(
  { data, onCut, onSelect, onError },
  ref,
) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => buildZoneEditorHtml(), []);
  const run = useCallback((js: string) => {
    web.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    reject: () => run('avz.reject()'),
    fit: () => run('avz.fit()'),
    zoom: d => run(`avz.zoom(${Number(d) || 0})`),
  }), [run]);

  useEffect(() => { if (ready) run(`avz.setData(${safeJson(data)})`); }, [ready, data, run]);

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
        scrollEnabled={false}
        onMessage={event => {
          const msg = parseZoneEditorMessage(event.nativeEvent.data);
          if (!msg) return;
          if (msg.type === 'ready') setReady(true);
          else if (msg.type === 'cut') onCut({ a: msg.a, b: msg.b });
          else if (msg.type === 'select') onSelect(msg.index);
          else if (msg.type === 'error') onError?.();
        }}
      />
    </View>
  );
});

export default ZoneEditorMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#0b1f17' },
  web: { flex: 1, backgroundColor: '#0b1f17' },
});
