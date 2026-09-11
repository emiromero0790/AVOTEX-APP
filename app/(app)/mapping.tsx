import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Poppins_400Regular, useFonts } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import { Eraser, MapPin, MapPinOff, Navigation, Pencil, Save, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import PolygonMap, { PolygonMapHandle } from '../../components/PolygonMap';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';

const LOCATION_SETTING_KEY = 'avotex_share_location';
const mappingTranslations: TranslationResource = {
  searching: { es: 'Buscando ubicación', en: 'Searching for location' },
  preciseReading: { es: 'Obteniendo una lectura precisa del GPS…', en: 'Getting a precise GPS reading…' },
  gettingPrecise: { es: 'Obteniendo tu ubicación precisa…', en: 'Getting your precise location…' },
  disabled: { es: 'Ubicación desactivada', en: 'Location disabled' },
  enableSettings: { es: 'Actívala desde Ajustes para usar el mapa.', en: 'Enable it in Settings to use the map.' },
  disabledNotice: { es: 'La ubicación está desactivada en Ajustes.', en: 'Location is disabled in Settings.' },
  permissionNotice: { es: 'Activa el permiso de ubicación para mostrar tu posición en el mapa.', en: 'Enable location permission to show your position on the map.' },
  unavailable: { es: 'Ubicación no disponible', en: 'Location unavailable' },
  devicePermission: { es: 'Activa el permiso de ubicación en tu dispositivo.', en: 'Enable location permission on your device.' },
  readyAccuracy: { es: 'Ubicación lista · precisión aproximada de {meters} m.', en: 'Location ready · approximate accuracy of {meters} m.' },
  ready: { es: 'Ubicación precisa lista.', en: 'Precise location ready.' },
  gpsError: { es: 'No pudimos obtener tu ubicación. Revisa que el GPS esté activo e inténtalo de nuevo.', en: 'We could not get your location. Check that GPS is active and try again.' },
  gpsCheck: { es: 'Revisa que el GPS esté activo.', en: 'Check that GPS is active.' },
  current: { es: 'Ubicación actual', en: 'Current location' },
  boundaryReady: { es: 'Delimitación lista para guardar.', en: 'Boundary ready to save.' },
  tapCorners: { es: 'Toca cada esquina de tu huerta.', en: 'Tap each corner of your garden.' },
  drawInstruction: { es: 'Toca cada esquina de tu huerta y cierra la figura en el primer punto.', en: 'Tap each corner of your garden and close the shape at the first point.' },
  cleared: { es: 'Delimitación borrada. Puedes comenzar de nuevo.', en: 'Boundary cleared. You can start again.' },
  waiting: { es: 'Esperaremos una lectura precisa antes de mostrar el mapa.', en: 'We will wait for a precise reading before showing the map.' },
  enableShare: { es: 'Activa Compartir ubicación en Ajustes para mostrar y delimitar tu huerta.', en: 'Enable Share location in Settings to show and outline your garden.' },
  eyebrow: { es: 'TU UBICACIÓN', en: 'YOUR LOCATION' },
  title: { es: 'Delimita tu huerta', en: 'Outline your garden' },
  points: { es: '{count} pts', en: '{count} pts' },
  draw: { es: 'Dibujar', en: 'Draw' },
  erase: { es: 'Borrar', en: 'Erase' },
  drawLabel: { es: 'Dibujar delimitación', en: 'Draw boundary' },
  eraseLabel: { es: 'Borrar delimitación', en: 'Erase boundary' },
  preview: { es: 'VISTA PREVIA', en: 'PREVIEW' },
  zone: { es: 'Zona delimitada', en: 'Outlined area' },
  closePreview: { es: 'Cerrar vista previa', en: 'Close preview' },
  marked: { es: 'PUNTOS MARCADOS', en: 'MARKED POINTS' },
  pointCount: { es: '{count} puntos', en: '{count} points' },
  contour: { es: 'Contorno listo', en: 'Outline ready' },
  save: { es: 'Guardar delimitación', en: 'Save boundary' },
  saveLabel: { es: 'Guardar delimitación', en: 'Save boundary' },
};

type PolygonPoint = {
  latitude: number;
  longitude: number;
};

export default function Mapping() {
  const t = useTranslations(mappingTranslations);
  const { locale } = useLanguage();
  useFonts({ Poppins_400Regular });
  const mapRef = useRef<PolygonMapHandle>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationTitle, setLocationTitle] = useState(t('searching'));
  const [locationDetail, setLocationDetail] = useState(t('preciseReading'));
  const [notice, setNotice] = useState<string | null>(t('gettingPrecise'));
  const [polygon, setPolygon] = useState<PolygonPoint[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const requestLocation = async () => {
        const savedValue = await AsyncStorage.getItem(LOCATION_SETTING_KEY);
        if (!active) return;
        const enabled = savedValue !== 'false';
        setLocationEnabled(enabled);

        if (!enabled) {
          setLocation(null);
          setPolygon([]);
          setPreviewVisible(false);
          setLocationTitle(t('disabled'));
          setLocationDetail(t('enableSettings'));
          setNotice(t('disabledNotice'));
          return;
        }

        try {
          setLocationTitle(t('searching'));
          setLocationDetail(t('preciseReading'));
          setNotice(t('gettingPrecise'));
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setNotice(t('permissionNotice'));
          setLocationTitle(t('unavailable'));
          setLocationDetail(t('devicePermission'));
          return;
        }
        setNotice(t('gettingPrecise'));
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
        if (active) {
          setLocation(current);
           setLocationTitle(t('current'));
          setLocationDetail(`${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
          const accuracy = current.coords.accuracy;
          setNotice(
            typeof accuracy === 'number'
              ? t('readyAccuracy', { meters: Math.round(accuracy) })
              : t('ready'),
          );
        }

        if (Platform.OS !== 'web') {
          try {
            const [address] = await Location.reverseGeocodeAsync({
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            });
            if (active && address) {
              const primary = address.street || address.name || address.district || address.city;
              const secondary = [address.district, address.city, address.region]
                .filter((part, index, parts) => part && parts.indexOf(part) === index)
                .join(', ');
               setLocationTitle(primary || t('current'));
              setLocationDetail(secondary || `${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
            }
          } catch {
            if (active) {
               setLocationTitle(t('current'));
              setLocationDetail(`${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`);
            }
          }
        }
        } catch {
          if (active) {
             setNotice(t('gpsError'));
             setLocationTitle(t('unavailable'));
             setLocationDetail(t('gpsCheck'));
          }
        }
      };

      requestLocation();
      return () => {
        active = false;
      };
    }, [t, locale]),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        {locationEnabled && location ? (
          <PolygonMap
            ref={mapRef}
            location={location}
            onPolygonChange={(points: PolygonPoint[]) => {
              setPolygon(points);
              if (points.length >= 3) {
                 setNotice(t('boundaryReady'));
                setPreviewVisible(true);
              } else {
                 setNotice(t('tapCorners'));
              }
            }}
          />
        ) : (
          <View style={styles.locationLoading}>
            <View style={styles.locationLoadingIcon}>
              {locationEnabled
                ? <ActivityIndicator size="large" color="#0D756B" />
                : <MapPinOff size={31} color="#0D756B" />}
            </View>
            <Text style={styles.locationLoadingTitle}>
               {locationEnabled ? t('searching') : t('disabled')}
            </Text>
            <Text style={styles.locationLoadingText}>
              {locationEnabled
                 ? t('waiting')
                 : t('enableShare')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.locationCard}>
        <View style={styles.locationIcon}>
          <Navigation size={20} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <View style={styles.locationCopy}>
           <Text style={styles.locationEyebrow}>{t('eyebrow')}</Text>
          <Text style={styles.locationCardTitle} numberOfLines={1}>{locationTitle}</Text>
          <Text style={styles.locationCardDetail} numberOfLines={1}>{locationDetail}</Text>
        </View>
        <MapPin size={19} color="#9EE7D2" />
      </View>

      <BlurView intensity={55} tint="light" style={styles.bottomPanel}>
        <View style={styles.panelCopy}>
          <View>
           <Text style={styles.title}>{t('title')}</Text>
          </View>
          <View style={[styles.pointBadge, polygon.length >= 3 && styles.pointBadgeReady]}>
            <Text style={[styles.pointBadgeText, polygon.length >= 3 && styles.pointBadgeTextReady]}>
               {t('points', { count: polygon.length })}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
                 accessibilityLabel={t('drawLabel')}
            accessibilityState={{ disabled: !location }}
            disabled={!location}
            onPress={() => {
              mapRef.current?.startDrawing();
               setNotice(t('drawInstruction'));
            }}
            style={({ pressed }) => [
              styles.actionButton,
              !location && styles.actionButtonDisabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Pencil size={20} color="#176B62" />
             <Text style={styles.actionLabel}>{t('draw')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
             accessibilityLabel={t('eraseLabel')}
            accessibilityState={{ disabled: !location || polygon.length === 0 }}
            disabled={!location || polygon.length === 0}
            onPress={() => {
              mapRef.current?.clearDrawing();
              setPolygon([]);
               setNotice(t('cleared'));
            }}
            style={({ pressed }) => [
              styles.actionButton,
              (!location || polygon.length === 0) && styles.actionButtonDisabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Eraser size={20} color="#D1534A" />
             <Text style={styles.actionLabel}>{t('erase')}</Text>
          </Pressable>

        </View>
      </BlurView>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewVisible(false)}>
          <View style={styles.previewSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.previewHandle} />
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewEyebrow}>{t('preview')}</Text>
                <Text style={styles.previewTitle}>{t('zone')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                 accessibilityLabel={t('closePreview')}
                onPress={() => setPreviewVisible(false)}
                style={({ pressed }) => [styles.previewClose, pressed && styles.actionPressed]}
              >
                <X size={20} color="#173E36" />
              </Pressable>
            </View>

            <View style={styles.previewMap}>
              {location && (
                <PolygonMap
                  location={location}
                  initialPolygon={polygon}
                  preview
                />
              )}
            </View>

            <View style={styles.previewInfo}>
              <View>
                <Text style={styles.previewInfoLabel}>{t('marked')}</Text>
                <Text style={styles.previewInfoValue}>{t('pointCount', { count: polygon.length })}</Text>
              </View>
              <View style={styles.previewStatus}>
                <View style={styles.previewStatusDot} />
                 <Text style={styles.previewStatusText}>{t('contour')}</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
               accessibilityLabel={t('saveLabel')}
              style={({ pressed }) => [styles.previewSaveButton, pressed && styles.saveButtonPressed]}
            >
              <Save size={18} color="#FFFFFF" />
               <Text style={styles.previewSaveButtonText}>{t('save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#dbe9df' },
  mapLayer: { ...StyleSheet.absoluteFill },
  locationCard: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(5,7,7,0.94)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 11,
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137B6D',
  },
  locationCopy: { flex: 1, minWidth: 0 },
  locationEyebrow: { color: '#84C9B7', fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  locationCardTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '800', marginTop: 1 },
  locationCardDetail: { color: '#B9C4C1', fontSize: 10, lineHeight: 14, marginTop: 1 },
  bottomPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 106,
    paddingHorizontal: 17,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.66)',
    shadowColor: '#102D27',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  panelCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { color: '#000000', fontFamily: 'Poppins_400Regular', fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  pointBadge: {
    minWidth: 48,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#EEF3F1',
  },
  pointBadgeReady: { backgroundColor: '#DDF4EC' },
  pointBadgeText: { color: '#87928E', fontSize: 10, fontWeight: '700' },
  pointBadgeTextReady: { color: '#0D756B' },
  locationLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 38,
    backgroundColor: '#E9F3EF',
  },
  locationLoadingIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#173E36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  locationLoadingTitle: { color: '#173E36', fontSize: 17, fontWeight: '800' },
  locationLoadingText: {
    maxWidth: 300,
    marginTop: 6,
    color: '#657D76',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 12 },
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#F0F5F3',
  },
  actionPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  actionButtonDisabled: { opacity: 0.42 },
  actionLabel: { color: '#455E58', fontSize: 9, fontWeight: '700' },
  saveButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  previewBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 18,
    backgroundColor: 'rgba(8,18,15,0.46)',
  },
  previewSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 16,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  previewHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: '#D5DBD9',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    marginBottom: 12,
  },
  previewEyebrow: { color: '#6B817B', fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  previewTitle: { color: '#101817', fontSize: 21, lineHeight: 27, fontWeight: '500', marginTop: 1 },
  previewClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F1',
  },
  previewMap: {
    height: 205,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#DCE9E3',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 13,
  },
  previewInfoLabel: { color: '#82908C', fontSize: 8, fontWeight: '700', letterSpacing: 1.1 },
  previewInfoValue: { color: '#172E29', fontSize: 15, fontWeight: '500', marginTop: 2 },
  previewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#E3F5EF',
  },
  previewStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#0D9B78' },
  previewStatusText: { color: '#16745F', fontSize: 10, fontWeight: '600' },
  previewSaveButton: {
    minHeight: 48,
    marginTop: 13,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D756B',
    shadowColor: '#0D756B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  previewSaveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});