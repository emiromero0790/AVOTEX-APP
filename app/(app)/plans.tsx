import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown, Sparkles } from 'lucide-react-native';

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
  const selectPlan = (name: string) => Alert.alert('Planes Avotex', 'Próximamente podrás contratar este plan desde la app.', [{ text: 'Entendido' }]);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Regresar">
          <ArrowLeft size={20} color="#0F766E" /><Text style={styles.backText}>Regresar</Text>
        </TouchableOpacity>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Crown size={28} color="#0F766E" /></View>
          <Text style={styles.kicker}>AVOTEX PROTEGE TU SIGUIENTE COSECHA</Text>
          <Text style={styles.title}>Planes y precios</Text>
          <Text style={styles.subtitle}>Más tokens para mirar tu campo con mayor detalle. Elige cuando estés listo.</Text>
        </View>
        {plans.map(plan => (
          <View key={plan.name} style={[styles.card, plan.popular && styles.featured]}>
            {plan.popular && <View style={styles.popular}><Sparkles size={14} color="#6E4B00" /><Text style={styles.popularText}>Más Popular</Text></View>}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.price}>{plan.price}</Text>
            <Text style={[styles.tokens, { backgroundColor: plan.color }]}>{plan.tokens}</Text>
            <View style={styles.features}>{plan.features.map(feature => <View key={feature} style={styles.feature}><Check size={17} color="#0F766E" /><Text style={styles.featureText}>{feature}</Text></View>)}</View>
            <TouchableOpacity style={[styles.select, plan.popular && styles.selectFeatured]} onPress={() => selectPlan(plan.name)} accessibilityRole="button">
              <Text style={[styles.selectText, plan.popular && styles.selectFeaturedText]}>Seleccionar plan</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Text style={styles.note}>No se realizan cargos desde esta pantalla. La contratación estará disponible próximamente.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5FAF8' },
  content: { padding: 22, paddingTop: 50, paddingBottom: 130, maxWidth: 1080, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { color: '#0F766E', fontWeight: '700', fontSize: 14 },
  hero: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 12 },
  heroIcon: { width: 62, height: 62, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DFF1ED', marginBottom: 14 },
  kicker: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: '#173D3A', fontSize: 34, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  subtitle: { color: '#67807C', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 520, marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: '#D8E8E4', shadowColor: '#0F766E', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  featured: { borderColor: '#0F766E', borderWidth: 2, backgroundColor: '#FBFFFE' },
  popular: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8E5B7', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 13 },
  popularText: { color: '#6E4B00', fontSize: 11, fontWeight: '800' },
  planName: { color: '#173D3A', fontSize: 21, fontWeight: '800' },
  price: { color: '#0F766E', fontSize: 32, fontWeight: '800', marginTop: 9 },
  tokens: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, color: '#225B55', fontSize: 12, fontWeight: '700', marginTop: 5, overflow: 'hidden' },
  features: { gap: 12, marginTop: 20, marginBottom: 22 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  featureText: { flex: 1, color: '#526A67', fontSize: 13, lineHeight: 19 },
  select: { borderWidth: 1.5, borderColor: '#0F766E', borderRadius: 15, paddingVertical: 13, alignItems: 'center' },
  selectFeatured: { backgroundColor: '#0F766E' },
  selectText: { color: '#0F766E', fontSize: 14, fontWeight: '800' },
  selectFeaturedText: { color: '#FFFFFF' },
  note: { textAlign: 'center', color: '#82928F', fontSize: 12, lineHeight: 18, paddingHorizontal: 20, marginTop: 4 },
});