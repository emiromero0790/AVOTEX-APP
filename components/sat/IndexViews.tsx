/**
 * Presentación de los índices de un reporte. Reglas:
 * - null/undefined se muestra como "Sin dato", nunca como 0.
 * - Un valor fuera del rango matemático se muestra tal cual, marcado como dato inválido.
 * - Las bandas de color son una interpretación general, no un diagnóstico.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AlertTriangle, CloudRain, Cloud, Droplets, ThermometerSun, ThermometerSnowflake, Wind } from 'lucide-react-native';
import {
  bandSegments, formatIndex, formatRange, INDEX_SPECS, readIndex,
  type IndexKey, type IndexSpec,
} from '../../services/indices';
import type { SatelliteReport } from '../../services/reports';

export type Lang = 'es' | 'en';
export const SAT = {
  card: 'rgba(9,30,23,0.9)',
  cardSoft: 'rgba(25,58,44,0.7)',
  line: 'rgba(206,232,171,0.16)',
  lime: '#D8F36B',
  ink: '#F2F6E5',
  soft: '#C9D8CC',
  muted: '#93A89B',
  amber: '#FBBF24',
} as const;

const T = {
  noData: { es: 'Sin dato', en: 'No data' },
  invalid: { es: 'Fuera de rango', en: 'Out of range' },
  validRange: { es: 'Rango válido', en: 'Valid range' },
  above: { es: 'por encima de la escala', en: 'above the scale' },
  below: { es: 'por debajo de la escala', en: 'below the scale' },
  unusual: { es: 'Valor inusual', en: 'Unusual value' },
};

const polar = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((Math.PI * deg) / 180), y: cy + r * Math.sin((Math.PI * deg) / 180) });
function arc(a0: number, a1: number, r: number, cx = 100, cy = 92) {
  const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

/** Medidor semicircular del NDVI, con sus bandas de interpretación de −1 a 1. */
export function NdviDial({ value, lang }: { value: number | null; lang: Lang }) {
  const spec = INDEX_SPECS.ndvi;
  const r = readIndex(spec, value);
  const segs = bandSegments(spec);
  const needle = r.kind === 'ok' ? polar(100, 92, 60, 180 + r.position * 180) : null;
  return (
    <View style={s.dial} accessible accessibilityLabel={`NDVI: ${r.kind === 'ok' ? formatIndex(spec, r.value) + ', ' + r.band.label[lang] : r.kind === 'invalid' ? T.invalid[lang] : T.noData[lang]}`}>
      <View style={s.kickerRow}>
        <Text style={s.kicker}>NDVI</Text>
        <Text style={s.kickerHint} numberOfLines={1}>{spec.measures[lang]}</Text>
      </View>
      <Svg width="100%" height={118} viewBox="0 0 200 118">
        {segs.map((g, i) => (
          <Path key={i} d={arc(180 + g.from * 180 + (i ? 1.6 : 0), 180 + g.to * 180 - (i < segs.length - 1 ? 1.6 : 0), 76)} stroke={g.color} strokeOpacity={r.kind === 'invalid' ? 0.35 : 1} strokeWidth={12} fill="none" strokeLinecap="butt" />
        ))}
        {needle && <Line x1={100} y1={92} x2={needle.x} y2={needle.y} stroke="#F5F8E7" strokeWidth={3} strokeLinecap="round" />}
        {needle && <Circle cx={100} cy={92} r={6.5} fill="#F5F8E7" />}
        {needle && <Circle cx={100} cy={92} r={2.6} fill="#173525" />}
      </Svg>
      <View style={s.dialScale}>
        <Text style={s.scaleText}>−1</Text><Text style={s.scaleText}>0</Text><Text style={s.scaleText}>1</Text>
      </View>
      <View style={s.dialReading}>
        {r.kind === 'missing' ? (
          <Text style={s.missingBig}>{T.noData[lang]}</Text>
        ) : (
          <Text style={[s.dialValue, r.kind === 'invalid' && { color: SAT.amber }]}>{formatIndex(spec, r.value)}</Text>
        )}
        {r.kind === 'ok' && <BandChip color={r.band.color} label={r.band.label[lang]} />}
        {r.kind === 'invalid' && <InvalidNote spec={spec} lang={lang} />}
      </View>
    </View>
  );
}

function BandChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.band}>
      <View style={[s.bandDot, { backgroundColor: color }]} />
      <Text style={s.bandText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function InvalidNote({ spec, lang }: { spec: IndexSpec; lang: Lang }) {
  return (
    <View style={s.invalid}>
      <AlertTriangle size={11} color={SAT.amber} />
      <Text style={s.invalidText} numberOfLines={2}>{T.invalid[lang]} · {T.validRange[lang]} {formatRange(spec, lang)}</Text>
    </View>
  );
}

/** Barra con las bandas de interpretación y un marcador en el valor. */
function BandGauge({ spec, position, dim, reduced }: { spec: IndexSpec; position: number | null; dim: boolean; reduced: boolean }) {
  const segs = bandSegments(spec);
  return (
    <View style={s.gauge}>
      <View style={s.track}>
        {segs.map((g, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${g.from * 100}%`, width: `${(g.to - g.from) * 100}%`, paddingHorizontal: 1 }}>
            <View style={{ flex: 1, borderRadius: 2, backgroundColor: g.color, opacity: dim ? 0.3 : 1 }} />
          </View>
        ))}
      </View>
      {position !== null && (
        // Marcador absoluto y sin hijos: animar `left` no reacomoda nada más.
        <Reanimated.View
          style={[s.marker, {
            left: `${position * 100}%`,
            transitionProperty: reduced ? 'none' : 'left',
            transitionDuration: 260,
            transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
          } as object]}
        />
      )}
      <View style={s.bounds}>
        <Text style={s.scaleText}>{formatIndex(spec, spec.display[0])}</Text>
        <Text style={s.scaleText}>{formatIndex(spec, spec.display[1])}{spec.math[1] === null ? '+' : ''}</Text>
      </View>
    </View>
  );
}

export function IndexCard({ k, value, lang, reduced }: { k: IndexKey; value: number | null; lang: Lang; reduced: boolean }) {
  const spec = INDEX_SPECS[k];
  const r = readIndex(spec, value);
  return (
    <View style={s.card} accessible accessibilityLabel={`${spec.name}: ${r.kind === 'ok' ? formatIndex(spec, r.value) + ', ' + r.band.label[lang] : r.kind === 'invalid' ? `${formatIndex(spec, r.value)}, ${T.invalid[lang]}` : T.noData[lang]}`}>
      <View style={s.cardTop}>
        <Text style={s.cardName}>{spec.name}</Text>
        {r.kind === 'invalid' && <AlertTriangle size={13} color={SAT.amber} />}
      </View>
      <Text style={s.cardMeasures} numberOfLines={2}>{spec.measures[lang]}</Text>
      {r.kind === 'missing' ? (
        <Text style={s.missing}>{T.noData[lang]}</Text>
      ) : (
        <Text style={[s.cardValue, r.kind === 'invalid' && { color: SAT.amber }]}>{formatIndex(spec, r.value)}</Text>
      )}
      {r.kind === 'ok' && <BandChip color={r.band.color} label={r.band.label[lang]} />}
      {r.kind === 'ok' && r.beyond && <Text style={s.beyond}>{r.beyond === 'high' ? T.above[lang] : T.below[lang]}</Text>}
      {r.kind === 'invalid' && <InvalidNote spec={spec} lang={lang} />}
      <BandGauge spec={spec} position={r.kind === 'ok' ? r.position : null} dim={r.kind !== 'ok'} reduced={reduced} />
    </View>
  );
}

type ClimateItem = { key: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; text: string | null; unusual: boolean };

export function ClimateGrid({ report, lang, labels }: {
  report: SatelliteReport;
  lang: Lang;
  labels: { precipitation: string; humidity: string; clouds: string; wind: string; tempMax: string; tempMin: string };
}) {
  const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const fmt = (v: number | null, d: number, unit: string) => (v === null ? null : `${v.toFixed(d)}${unit}`);
  const p = n(report.precipitacion), h = n(report.humedad), c = n(report.cobertura_nubes), w = n(report.viento), tx = n(report.temp_max), tn = n(report.temp_min);
  const items: ClimateItem[] = [
    { key: 'p', label: labels.precipitation, icon: CloudRain, text: fmt(p, 1, ' mm'), unusual: p !== null && p < 0 },
    { key: 'h', label: labels.humidity, icon: Droplets, text: fmt(h, 0, ' %'), unusual: h !== null && (h < 0 || h > 100) },
    { key: 'c', label: labels.clouds, icon: Cloud, text: fmt(c, 0, ' %'), unusual: c !== null && (c < 0 || c > 100) },
    { key: 'w', label: labels.wind, icon: Wind, text: fmt(w, 1, ' m/s'), unusual: w !== null && w < 0 },
    { key: 'tx', label: labels.tempMax, icon: ThermometerSun, text: fmt(tx, 1, ' °C'), unusual: tx !== null && (tx < -40 || tx > 60) },
    { key: 'tn', label: labels.tempMin, icon: ThermometerSnowflake, text: fmt(tn, 1, ' °C'), unusual: tn !== null && (tn < -40 || tn > 60 || (tx !== null && tn > tx)) },
  ];
  return (
    <View style={s.climate}>
      {items.map(it => {
        const Icon = it.icon;
        return (
          <View key={it.key} style={s.climateItem} accessible accessibilityLabel={`${it.label}: ${it.text ?? T.noData[lang]}`}>
            <View style={s.climateIcon}><Icon size={14} color={SAT.lime} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.climateLabel} numberOfLines={1}>{it.label}</Text>
              <Text style={[s.climateValue, it.text === null && s.climateMissing, it.unusual && { color: SAT.amber }]} numberOfLines={1}>
                {it.text ?? T.noData[lang]}
              </Text>
              {it.unusual && <Text style={s.unusual}>{T.unusual[lang]}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  dial: { padding: 14, paddingBottom: 12, borderRadius: 18, backgroundColor: SAT.cardSoft, borderWidth: 1, borderColor: SAT.line },
  kickerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kicker: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 13 },
  kickerHint: { flex: 1, color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10 },
  dialScale: { marginTop: -24, paddingHorizontal: '9%', flexDirection: 'row', justifyContent: 'space-between' },
  dialReading: { alignItems: 'center', marginTop: 6, gap: 6 },
  dialValue: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  missingBig: { color: SAT.muted, fontFamily: 'Poppins_600SemiBold', fontSize: 18, lineHeight: 36 },
  band: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  bandDot: { width: 7, height: 7, borderRadius: 4 },
  bandText: { color: SAT.soft, fontFamily: 'Poppins_600SemiBold', fontSize: 10, flexShrink: 1 },
  invalid: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'stretch', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(251,191,36,0.12)' },
  invalidText: { flex: 1, color: '#FDE68A', fontFamily: 'Poppins_600SemiBold', fontSize: 9, lineHeight: 13 },
  card: { flexBasis: '47%', flexGrow: 1, minWidth: 140, padding: 12, borderRadius: 16, backgroundColor: SAT.cardSoft, borderWidth: 1, borderColor: SAT.line, gap: 5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 12, letterSpacing: 0.3 },
  cardMeasures: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 9, lineHeight: 12, minHeight: 24 },
  cardValue: { color: SAT.ink, fontFamily: 'Poppins_700Bold', fontSize: 22, lineHeight: 27 },
  missing: { color: SAT.muted, fontFamily: 'Poppins_600SemiBold', fontSize: 14, lineHeight: 27 },
  beyond: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 9 },
  gauge: { marginTop: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  marker: { position: 'absolute', top: -4, width: 4, height: 14, marginLeft: -2, borderRadius: 2, backgroundColor: '#F8FFE4', borderWidth: 1, borderColor: '#0b1f17' },
  bounds: { marginTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 9 },
  climate: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  climateItem: { flexBasis: '47%', flexGrow: 1, minHeight: 58, padding: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: SAT.cardSoft, borderWidth: 1, borderColor: SAT.line },
  climateIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,243,107,0.12)' },
  climateLabel: { color: SAT.muted, fontFamily: 'Poppins_400Regular', fontSize: 10 },
  climateValue: { color: SAT.ink, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  climateMissing: { color: SAT.muted, fontSize: 12 },
  unusual: { color: '#FDE68A', fontFamily: 'Poppins_400Regular', fontSize: 9 },
});
