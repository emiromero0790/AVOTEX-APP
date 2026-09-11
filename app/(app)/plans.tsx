import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check, Crown, Leaf, ShieldCheck, Sparkles } from 'lucide-react-native';
import { TranslationResource, useTranslations } from '../../context/LanguageContext';

const planData = [
  {
    key: 'free', name: 'plans.free', shortName: 'plans.freeShort', price: '$0', tokens: 'plans.freeTokens', color: '#DFF1ED',
    features: ['plans.free1', 'plans.free2', 'plans.free3', 'plans.free5'],
  },
  {
    key: 'basic', name: 'plans.basic', shortName: 'plans.basicShort', price: '$1,190', tokens: 'plans.basicTokens', color: '#BFE5DC', popular: true,
    features: ['plans.basic1', 'plans.basic2', 'plans.basic3', 'plans.basic4', 'plans.basic5', 'plans.basic7'],
  },
  {
    key: 'pro', name: 'plans.pro', shortName: 'plans.proShort', price: '$4,490', tokens: 'plans.proTokens', color: '#F8E5B7',
    features: ['plans.pro1', 'plans.pro2', 'plans.pro3', 'plans.pro4', 'plans.pro5', 'plans.pro6', 'plans.pro7'],
  },
];
const translations: TranslationResource = {
  'plans.free': { es: 'Plan Free', en: 'Free Plan' }, 'plans.freeShort': { es: 'Free', en: 'Free' }, 'plans.freeTokens': { es: '2500 tokens/mensuales', en: '2500 tokens/month' },
  'plans.basic': { es: 'Plan Básico', en: 'Basic Plan' }, 'plans.basicShort': { es: 'Básico', en: 'Basic' }, 'plans.basicTokens': { es: '45000 tokens/mensuales', en: '45000 tokens/month' },
  'plans.pro': { es: 'Plan Pro Satelital', en: 'Satellite Pro Plan' }, 'plans.proShort': { es: 'Pro Satelital', en: 'Satellite Pro' }, 'plans.proTokens': { es: '250000 tokens/mensuales', en: '250000 tokens/month' },
  'plans.free1': { es: '1 huerto registrado', en: '1 registered orchard' }, 'plans.free2': { es: 'Reportes básicos de clima diario', en: 'Basic daily weather reports' }, 'plans.free3': { es: 'Historial básico de análisis', en: 'Basic analysis history' }, 'plans.free5': { es: 'Notificaciones de uso y recordatorios', en: 'Usage notifications and reminders' },
  'plans.basic1': { es: 'Análisis con IA (85–90% precisión) basado en CNN', en: 'AI analysis (85–90% accuracy) based on CNN' }, 'plans.basic2': { es: 'Historial detallado por árbol y lote', en: 'Detailed history by tree and plot' }, 'plans.basic3': { es: 'Reportes climáticos extendidos', en: 'Extended weather reports' }, 'plans.basic4': { es: 'Alertas tempranas basadas en clima', en: 'Weather-based early alerts' }, 'plans.basic5': { es: 'Acceso a la app móvil', en: 'Access to the mobile app' }, 'plans.basic7': { es: 'Soporte por WhatsApp', en: 'WhatsApp support' },
  'plans.pro1': { es: 'Monitoreo satelital EOSDA', en: 'EOSDA satellite monitoring' }, 'plans.pro2': { es: 'Análisis avanzado de riesgos climáticos', en: 'Advanced climate risk analysis' }, 'plans.pro3': { es: 'IA profesional', en: 'Professional AI' }, 'plans.pro4': { es: 'Diagnósticos ilimitados', en: 'Unlimited diagnoses' }, 'plans.pro5': { es: 'Algoritmo CNN propio TensorFlow', en: 'Proprietary TensorFlow CNN algorithm' }, 'plans.pro6': { es: 'Plataforma Web + App móvil', en: 'Web platform + mobile app' }, 'plans.pro7': { es: 'Soporte premium', en: 'Premium support' },
  'plans.back': { es: 'Regresar', en: 'Back' }, 'plans.kicker': { es: 'AVOTEX PROTEGE TU SIGUIENTE COSECHA', en: 'AVOTEX PROTECTS YOUR NEXT HARVEST' }, 'plans.title': { es: 'Planes y precios', en: 'Plans and pricing' }, 'plans.subtitle': { es: 'Más tokens para mirar tu campo con mayor detalle. Elige cuando estés listo.', en: 'More tokens to see your field in greater detail. Choose when you are ready.' }, 'plans.popular': { es: 'Más Popular', en: 'Most Popular' }, 'plans.includes': { es: 'Incluye {plan}', en: 'Includes {plan}' }, 'plans.available': { es: 'Lo que tienes disponible', en: 'What you have available' }, 'plans.note': { es: 'Sin cargos por ahora · Puedes cambiar de plan después', en: 'No charges for now · You can change plans later' }, 'plans.select': { es: 'Seleccionar {plan}', en: 'Select {plan}' }, 'plans.selectLabel': { es: 'Seleccionar {plan}', en: 'Select {plan}' }, 'plans.urlError': { es: 'URL no disponible', en: 'URL unavailable' }, 'plans.alertTitle': { es: 'No se pudo abrir el sitio', en: 'Could not open the website' }, 'plans.alertBody': { es: 'Intenta nuevamente en unos segundos.', en: 'Try again in a few seconds.' }, 'plans.alertOk': { es: 'Entendido', en: 'Got it' }, 'plans.premiumLabel': { es: 'Símbolo de planes premium Avotex', en: 'Avotex premium plans symbol' },
};

export default function PlansScreen() {
  const t = useTranslations(translations);
  const plans = planData.map(plan => ({ ...plan, name: t(plan.name), shortName: t(plan.shortName), tokens: t(plan.tokens), features: plan.features.map(feature => t(feature)) }));
  const [selectedPlanKey, setSelectedPlanKey] = useState('basic');
  const selectedPlan = plans.find(plan => plan.key === selectedPlanKey) ?? plans[1];
  const selectPlan = async () => {
    try {
      const supported = await Linking.canOpenURL('https://vex-mx.com/avotex.html#pricing');
      if (!supported) throw new Error(t('plans.urlError'));
      await Linking.openURL('https://vex-mx.com/avotex.html#pricing');
    } catch {
      Alert.alert(t('plans.alertTitle'), t('plans.alertBody'), [{ text: t('plans.alertOk') }]);
    }
  };
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel={t('plans.back')}>
          <ArrowLeft size={20} color="#0F766E" /><Text style={styles.backText}>{t('plans.back')}</Text>
        </TouchableOpacity>
        <View style={styles.hero}>
            <View style={styles.illustration} accessibilityLabel={t('plans.premiumLabel')}>
            <View style={styles.orbitOne} />
            <View style={styles.orbitTwo} />
            <View style={styles.illustrationShadow} />
            <View style={styles.crownShell}>
              <Crown size={72} color="#0F766E" fill="#79D7C1" strokeWidth={1.6} />
              <View style={styles.sparkleTop}><Sparkles size={22} color="#D7A945" fill="#F8E5B7" /></View>
              <View style={styles.leafBadge}><Leaf size={22} color="#F7FFFA" fill="#0F766E" /></View>
            </View>
          </View>
          <Text style={styles.kicker}>{t('plans.kicker')}</Text>
          <Text style={styles.title}>{t('plans.title')}</Text>
          <Text style={styles.subtitle}>{t('plans.subtitle')}</Text>
        </View>
        <View style={styles.cards}>
          {plans.map(plan => (
            <TouchableOpacity key={plan.key} style={[styles.card, plan.popular && styles.featured, selectedPlan.key === plan.key && styles.selectedCard]} onPress={() => setSelectedPlanKey(plan.key)} accessibilityRole="radio" accessibilityState={{ selected: selectedPlan.key === plan.key }} accessibilityLabel={t('plans.selectLabel', { plan: plan.name })}>
              {plan.popular && <View style={styles.popular}><Text style={styles.popularText}>{t('plans.popular')}</Text></View>}
              <Text style={styles.planName} numberOfLines={1}>{plan.shortName}</Text>
              <Text style={styles.price} numberOfLines={1}>{plan.price}</Text>
              <Text style={[styles.tokens, { backgroundColor: plan.color }]} numberOfLines={2}>{plan.tokens}</Text>
              <View style={[styles.radio, selectedPlan.name === plan.name && styles.radioSelected]} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.benefits}>
          <View style={styles.benefitsHeading}>
            <View><Text style={styles.benefitsEyebrow}>{t('plans.includes', { plan: selectedPlan.shortName })}</Text><Text style={styles.benefitsTitle}>{t('plans.available')}</Text></View>
            <ShieldCheck size={22} color="#0F766E" />
          </View>
          {selectedPlan.features.map(feature => <View key={feature} style={styles.feature}><View style={styles.check}><Check size={13} color="#0F766E" strokeWidth={3} /></View><Text style={styles.featureText}>{feature}</Text></View>)}
        </View>
        <Text style={styles.note}>{t('plans.note')}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={selectPlan} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{t('plans.select', { plan: selectedPlan.shortName })}</Text>
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