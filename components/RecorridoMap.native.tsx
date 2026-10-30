import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildRecorridoMapHtml, RecorridoMapProps } from './recorridoMapHtml';

export type { RecorridoMapProps } from './recorridoMapHtml';

export default function RecorridoMap({ route, markers, polygon, selectedId, onSelect }: RecorridoMapProps) {
  const ref = useRef<WebView>(null);
  const html = useMemo(() => buildRecorridoMapHtml({ route, markers, polygon }), [route, markers, polygon]);

  useEffect(() => {
    if (selectedId) ref.current?.injectJavaScript(`window.selectHallazgo && window.selectHallazgo(${JSON.stringify(selectedId)}); true;`);
  }, [selectedId]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        onMessage={event => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg?.type === 'select' && typeof msg.id === 'string') onSelect?.(msg.id);
          } catch {
            /* mensaje ajeno */
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#dbe9df' },
});
