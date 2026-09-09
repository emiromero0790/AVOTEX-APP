import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown, Leaf, ShieldCheck, Sparkles } from 'lucide-react-native';

const plans = [
  {
    name: 'Plan Free', price: '$0', tokens: '2500 tokens/mensuales', color: '#DFF1ED',
    features: ['1 huerto registrado', 'Reportes básicos de clima diario', 'Historial básico de análisis', 'Modo daltonismo y accesibilidad', 'Notificaciones de uso y recordatorios'],
  },
  {
    name: 'Plan Básico', price: '$1,190', tokens: '45000 tokens/mensuales', color: '#BFE5DC', popular: true,
    features: ['Análisis con IA (85–90% precisión) basado en CNN', 'Historial detallado por árbol y lote', 'Reportes climáticos extendidos', 'Alertas tempranas basadas en clima', 'Acceso a la app móvil', 'Modo daltonismo y accesibilidad', 'Soporte por WhatsApp'],
  },
  {
    name: 'Plan Pro Satelital', price: '$4,490', tokens: '250000 tokens/mensuales', color: '#F8E5B7',
    features: ['Monitoreo satelital EOSDA', 'Análisis avanzado de riesgos climáticos', 'IA profesional', 'Diagnósticos ilimitados', 'Algoritmo CNN propio TensorFlow', 'Plataforma Web + App móvil', 'Soporte premium'],
  },
];

export default function PlansScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const selectPlan = (name: string) => Alert.alert('Planes Avotex', 'Próximamente podrás contratar este plan desde la app.', [{ text: 'Entendido' }]);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Regresar">
          <ArrowLeft size={20} color="#0F766E" /><Text style={styles.backText}>Regresar</Text>
        </TouchableOpacity>
        <View style={styles.hero}>
          <View style={styles.illustration} accessibilityLabel="Símbolo de planes premium Avotex">
            <View style={styles.orbitOne} />
            <View style={styles.orbitTwo} />
            <View style={styles.illustrationShadow} />
            <View style={styles.crownShell}>
              <Crown size={72} color="#0F766E" fill="#79D7C1" strokeWidth={1.6} />
              <View style={styles.sparkleTop}><Sparkles size={22} color="#D7A945" fill="#F8E5B7" /></View>
              <View style={styles.leafBadge}><Leaf size={22} color="#F7FFFA" fill="#0F766E" /></View>
            </View>
          </View>
          <Text style={styles.kicker}>AVOTEX PROTEGE TU SIGUIENTE COSECHA</Text>
          <Text style={styles.title}>Planes y precios</Text>
          <Text style={styles.subtitle}>Más tokens para mirar tu campo con mayor detalle. Elige cuando estés listo.</Text>
        </View>
        <View style={[styles.cards, wide && styles.cardsWide]}>
          {plans.map(plan => (
            <View key={plan.name} style={[styles.card, wide && styles.cardWide, plan.popular && styles.featured]}>
              {plan.popular && <View style={styles.popular}><Sparkles size={14} color="#6E4B00" /><Text style={styles.popularText}>Más Popular</Text></View>}
              <View style={styles.planHeading}>
                <Text style={styles.planName}>{plan.name}</Text>
                {plan.popular && <ShieldCheck size={20} color="#0F766E" />}
              </View>
              <Text style={styles.price}>{plan.price}</Text>
              <Text style={[styles.tokens, { backgroundColor: plan.color }]}>{plan.tokens}</Text>
              <View style={styles.features}>{plan.features.map(feature => <View key={feature} style={styles.feature}><Check size={17} color="#0F766E" strokeWidth={2.5} /><Text style={styles.featureText}>{feature}</Text></View>)}</View>
              <TouchableOpacity style={[styles.select, plan.popular && styles.selectFeatured]} onPress={() => selectPlan(plan.name)} accessibilityRole="button">
                <Text style={[styles.selectText, plan.popular && styles.selectFeaturedText]}>Seleccionar plan</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <Text style={styles.note}>No se realizan cargos desde esta pantalla. La contratación estará disponible próximamente.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4FAF7' },
  content: { padding: 22, paddingTop: 48, paddingBottom: 110, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2 },
  backText: { color: '#0F766E', fontWeight: '700', fontSize: 14 },
  hero: { alignItems: 'center', paddingTop: 3, paddingBottom: 25, paddingHorizontal: 12 },
  illustration: { width: 190, height: 142, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  orbitOne: { position: 'absolute', width: 138, height: 138, borderRadius: 70, backgroundColor: '#DFF5EC', opacity: 0.9 },
  orbitTwo: { position: 'absolute', width: 108, height: 108, borderRadius: 54, backgroundColor: '#BCE9DA', opacity: 0.75, top: 11, left: 43 },
  illustrationShadow: { position: 'absolute', width: 82, height: 18, borderRadius: 50, backgroundColor: '#A6C9C0', opacity: 0.34, bottom: 11 },
  crownShell: { width: 126, height: 104, borderRadius: 48, backgroundColor: '#A8E4D0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }], shadowColor: '#0F766E', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  sparkleTop: { position: 'absolute', right: 6, top: 5 },
  leafBadge: { position: 'absolute', left: 8, bottom: 9, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5D98C', transform: [{ rotate: '14deg' }] },
  kicker: { color: '#0F766E', fontSize: 10, fontWeight: '800', letterSpacing: 1.25, textAlign: 'center' },
  title: { color: '#173D3A', fontSize: 34, fontWeight: '800', marginTop: 7, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { color: '#67807C', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 520, marginTop: 8 },
  cards: { width: '100%' },
  cardsWide: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  card: { backgroundColor: '#FFFDF9', borderRadius: 25, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: '#D8E8E4', shadowColor: '#0F766E', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardWide: { flex: 1, marginBottom: 0, minWidth: 0 },
  featured: { borderColor: '#0F766E', borderWidth: 2, backgroundColor: '#FBFFFE', shadowOpacity: 0.16, shadowRadius: 20 },
  popular: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8E5B7', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 13 },
  popularText: { color: '#6E4B00', fontSize: 11, fontWeight: '800' },
  planHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { color: '#173D3A', fontSize: 21, fontWeight: '800', flex: 1 },
  price: { color: '#0F766E', fontSize: 32, fontWeight: '800', marginTop: 9 },
  tokens: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, color: '#225B55', fontSize: 12, fontWeight: '700', marginTop: 5, overflow: 'hidden' },
  features: { gap: 12, marginTop: 20, marginBottom: 22, flex: 1 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  featureText: { flex: 1, color: '#526A67', fontSize: 13, lineHeight: 19 },
  select: { borderWidth: 1.5, borderColor: '#0F766E', borderRadius: 15, paddingVertical: 13, alignItems: 'center' },
  selectFeatured: { backgroundColor: '#0F766E' },
  selectText: { color: '#0F766E', fontSize: 14, fontWeight: '800' },
  selectFeaturedText: { color: '#FFFFFF' },
  note: { textAlign: 'center', color: '#82928F', fontSize: 12, lineHeight: 18, paddingHorizontal: 20, marginTop: 22 },
});