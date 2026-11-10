import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  TranslationResource,
  useTranslations,
} from "../../context/LanguageContext";
import type { ScansMapLayer, ScansMapRouteStyle } from "../scansMapHtml";
const MINT = "#A7F3D0";
const ROUTE_STYLES: ScansMapRouteStyle[] = [
  "clasica",
  "velocidad",
  "tiempo",
  "calor",
];
const translations: TranslationResource = {
  mapTypes: { es: "Tipos de mapa", en: "Map types" },
  routeStyles: { es: "Estilo de ruta", en: "Route style" },
  satelite: { es: "Satélite", en: "Satellite" },
  hibrido: { es: "Híbrido", en: "Hybrid" },
  estandar: { es: "Estándar", en: "Standard" },
  topo: { es: "Topográfico", en: "Topographic" },
  oscuro: { es: "Oscuro", en: "Dark" },
  zonas: { es: "Zonas", en: "Zones" },
  clasica: { es: "Clásica", en: "Classic" },
  velocidad: { es: "Velocidad", en: "Speed" },
  tiempo: { es: "Tiempo", en: "Time" },
  calor: { es: "Calor", en: "Heat" },
  clasicaSub: { es: "Un color", en: "One color" },
  velocidadSub: { es: "Lento → rápido", en: "Slow → fast" },
  tiempoSub: { es: "Inicio → fin", en: "Start → end" },
  calorSub: { es: "Donde más caminas", en: "Where you walk most" },
  selected: { es: "seleccionado", en: "selected" },
};

type Props = {
  layer: ScansMapLayer;
  routeStyle: ScansMapRouteStyle;
  zonesAvailable: boolean;
  onLayer: (l: ScansMapLayer) => void;
  onRouteStyle: (r: ScansMapRouteStyle) => void;
};

export default function MapStylePicker({
  layer,
  routeStyle,
  zonesAvailable,
  onLayer,
  onRouteStyle,
}: Props) {
  const t = useTranslations(translations);
  const layers: ScansMapLayer[] = [
    "oscuro",
    "satelite",
    "hibrido",
    "estandar",
    ...(zonesAvailable ? ["zonas" as const] : []),
  ];
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.section}>{t("mapTypes")}</Text>
      <View style={[s.grid, { gap: 8 }]}>
        {layers.map((l) => (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: layer === l }}
            onPress={() => onLayer(l)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: layer === l ? MINT : "#33434b",
              backgroundColor: layer === l ? "#144139" : "#172329",
            }}
          >
            <Text style={layer === l ? s.labelOn : s.label}>{t(l)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.section}>{t("routeStyles")}</Text>
      <View style={[s.grid, { gap: 8 }]}>
        {ROUTE_STYLES.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ checked: routeStyle === r }}
            onPress={() => onRouteStyle(r)}
            style={{
              padding: 12,
              borderRadius: 14,
              backgroundColor: routeStyle === r ? "#144139" : "#172329",
            }}
          >
            <Text style={routeStyle === r ? s.labelOn : s.label}>{t(r)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  thumbWrap: { borderRadius: 16, borderWidth: 2.5, padding: 2 },
  thumb: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E2A30",
  },
  label: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#AAB5BF" },
  labelOn: { fontFamily: "Poppins_700Bold", color: MINT },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10.5,
    color: "#7C8A96",
    marginTop: -4,
  },
  loading: { alignItems: "center", justifyContent: "center" },
  zones: { flexDirection: "row", flexWrap: "wrap", opacity: 0.45 },
  zone: {
    width: "50%",
    height: "50%",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.8)",
  },
});
