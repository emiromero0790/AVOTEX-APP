import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown, Leaf, ShieldCheck, Sparkles } from 'lucide-react-native';

const plans = [
  {
    name: 'Plan Free', shortName: 'Free', price: '$0', tokens: '2500 tokens/mensuales', color: '#DFF1ED',
    features: ['1 huerto registrado', 'Reportes básicos de clima diario', 'Historial básico de análisis', 'Modo daltonismo y accesibilidad', 'Notificaciones de uso y recordatorios'],
  },
  {
    name: 'Plan Básico', shortName: 'Básico', price: '$1,190', tokens: '45000 tokens/mensuales', color: '#BFE5DC', popular: true,
    features: ['Análisis con IA (85–90% precisión) basado en CNN', 'Historial detallado por árbol y lote', 'Reportes climáticos extendidos', 'Alertas tempranas basadas en clima', 'Acceso a la app móvil', 'Modo daltonismo y accesibilidad', 'Soporte por WhatsApp'],
  },
  {
    name: 'Plan Pro Satelital', shortName: 'Pro Satelital', price: '$4,490', tokens: '250000 tokens/mensuales', color: '#F8E5B7',
    features: ['Monitoreo satelital EOSDA', 'Análisis avanzado de riesgos climáticos', 'IA profesional', 'Diagnósticos ilimitados', 'Algoritmo CNN propio TensorFlow', 'Plataforma Web + App móvil', 'Soporte premium'],
  },
];

export default function PlansScreen() {
  const [selectedPlan, setSelectedPlan] = useState(plans[1]);
  const selectPlan = async () => {
    try {
      const supported = await Linking.canOpenURL('https://vex-mx.com/avotex.html#pricing');
      if (!supported) throw new Error('URL no disponible');
      await Linking.openURL('https://vex-mx.com/avotex.html#pricing');
    } catch {
      Alert.alert('No se pudo abrir el sitio', 'Intenta nuevamente en unos segundos.', [{ text: 'Entendido' }]);
    }
  };
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
        <View style={styles.cards}>
          {plans.map(plan => (
            <TouchableOpacity key={plan.name} style={[styles.card, plan.popular && styles.featured, selectedPlan.name === plan.name && styles.selectedCard]} onPress={() => setSelectedPlan(plan)} accessibilityRole="radio" accessibilityState={{ selected: selectedPlan.name === plan.name }} accessibilityLabel={`Seleccionar ${plan.name}`}>
              {plan.popular && <View style={styles.popular}><Text style={styles.popularText}>Más Popular</Text></View>}
              <Text style={styles.planName} numberOfLines={1}>{plan.shortName}</Text>
              <Text style={styles.price} numberOfLines={1}>{plan.price}</Text>
              <Text style={[styles.tokens, { backgroundColor: plan.color }]} numberOfLines={2}>{plan.tokens}</Text>
              <View style={[styles.radio, selectedPlan.name === plan.name && styles.radioSelected]} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.benefits}>
          <View style={styles.benefitsHeading}>
            <View><Text style={styles.benefitsEyebrow}>Incluye {selectedPlan.shortName}</Text><Text style={styles.benefitsTitle}>Lo que tienes disponible</Text></View>
            <ShieldCheck size={22} color="#0F766E" />
          </View>
          {selectedPlan.features.map(feature => <View key={feature} style={styles.feature}><View style={styles.check}><Check size={13} color="#0F766E" strokeWidth={3} /></View><Text style={styles.featureText}>{feature}</Text></View>)}
        </View>
        <Text style={styles.note}>Sin cargos por ahora · Puedes cambiar de plan después</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={selectPlan} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Seleccionar {selectedPlan.shortName}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4FAF7' },
  content: { padding: 18, paddingTop: 38, paddingBottom: 90, maxWidth: 620, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2 },
  backText: { color: '#0F766E', fontWeight: '700', fontSize: 14 },
  hero: { alignItems: 'center', paddingTop: 3, paddingBottom: 18, paddingHorizontal: 12 },
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
  cards: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  card: { flex: 1, minWidth: 0, minHeight: 126, backgroundColor: '#FFFDF9', borderRadius: 16, padding: 9, borderWidth: 1, borderColor: '#D8E8E4', shadowColor: '#0F766E', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  featured: { borderColor: '#D7A945', borderWidth: 1.5, backgroundColor: '#FBFFFE' },
  selectedCard: { borderColor: '#0F766E', borderWidth: 2, backgroundColor: '#F5FFFB' },
  popular: { alignSelf: 'stretch', backgroundColor: '#F8E5B7', borderRadius: 8, paddingVertical: 3, marginBottom: 7 },
  popularText: { color: '#6E4B00', fontSize: 8, fontWeight: '800', textAlign: 'center' },
  planName: { color: '#173D3A', fontSize: 13, fontWeight: '800', marginTop: 1 },
  price: { color: '#0F766E', fontSize: 18, fontWeight: '800', marginTop: 8 },
  tokens: { alignSelf: 'stretch', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 4, color: '#225B55', fontSize: 9, lineHeight: 11, fontWeight: '700', marginTop: 5, overflow: 'hidden' },
  radio: { alignSelf: 'center', width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#9ABDB6', marginTop: 8 },
  radioSelected: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  benefits: { backgroundColor: '#FFFDF9', borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#D8E8E4' },
  benefitsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  benefitsEyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  benefitsTitle: { color: '#173D3A', fontSize: 17, fontWeight: '800', marginTop: 3 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 9 },
  check: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#DFF1ED', alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, color: '#526A67', fontSize: 12, lineHeight: 17 },
  note: { textAlign: 'center', color: '#82928F', fontSize: 11, lineHeight: 16, paddingHorizontal: 20, marginTop: 16 },
  primaryButton: { backgroundColor: '#0F766E', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#F7FFFA', fontSize: 14, fontWeight: '800' },
});