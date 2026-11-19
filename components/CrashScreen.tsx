/**
 * Pantalla que reemplaza al cierre de la app cuando ocurre un error de JavaScript.
 *
 * Sin esto, en un build de producción un error al dibujar una pantalla cierra la app sin explicación.
 * Aquí se muestra el mensaje (para poder reportarlo con una captura) y un botón para reintentar.
 */
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

declare const ErrorUtils: {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
} | undefined;

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n\n${(error.stack ?? '').split('\n').slice(0, 8).join('\n')}`;
  return String(error);
}

/** Errores fatales fuera del dibujo (por ejemplo en un temporizador): aviso con el mensaje en vez de cerrar. */
export function installFatalErrorAlert() {
  if (typeof ErrorUtils === 'undefined' || __DEV__) return;
  const previous = ErrorUtils.getGlobalHandler();
  let shown = false;
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return previous(error, isFatal);
    if (shown) return;
    shown = true;
    Alert.alert('Ocurrió un error en Avotex', `Toma una captura de este mensaje para reportarlo.\n\n${describe(error)}`, [
      { text: 'Continuar', onPress: () => { shown = false; } },
    ]);
  });
}

/** ErrorBoundary de Expo Router: se muestra cuando una pantalla falla al dibujarse. */
export function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={s.root}>
      <Text style={s.title}>Algo salió mal</Text>
      <Text style={s.body}>Toma una captura de esta pantalla para reportarlo y toca «Reintentar».</Text>
      <ScrollView style={s.box} contentContainerStyle={{ padding: 12 }}>
        <Text style={s.code} selectable>{describe(error)}</Text>
      </ScrollView>
      <Pressable onPress={() => { retry(); }} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={s.btnText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F3E8', paddingHorizontal: 22, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#064B2C' },
  body: { fontSize: 15, color: '#334155', marginTop: 8, marginBottom: 16 },
  box: { flex: 1, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DBCB' },
  code: { fontSize: 12, color: '#7F1D1D', fontFamily: 'monospace' },
  btn: { marginTop: 16, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f766e' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
