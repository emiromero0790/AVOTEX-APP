import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Poppins_400Regular, useFonts } from '@expo-google-fonts/poppins';
import * as Location from 'expo-location';
import { ChevronRight, Eraser, MapPin, MapPinOff, MessageSquareText, Navigation, Pencil, Plus, Save, ShieldCheck, Sprout, Trash2, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import PolygonMap, { PolygonMapHandle } from '../../components/PolygonMap';
import { TranslationResource, useLanguage, useTranslations } from '../../context/LanguageContext';
import { auth } from '../../firebaseConfig';
import { deleteOrchard, listOrchards, Orchard, PolygonPoint, saveOrchard } from '../../services/orchards';

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
  orchards: { es: 'Tus huertas', en: 'Your orchards' },
  newOrchard: { es: 'Nueva huerta', en: 'New orchard' },
  noOrchards: { es: 'Aún no tienes huertas guardadas.', en: 'You do not have saved orchards yet.' },
  createFirst: { es: 'Crea una desde tu ubicación actual.', en: 'Create one from your current location.' },
  orchardName: { es: 'Nombre de la huerta', en: 'Orchard name' },
  orchardPlaceholder: { es: 'Ej. Huerta norte', en: 'E.g. North orchard' },
  editBoundary: { es: 'Editar', en: 'Edit' },
  saveChanges: { es: 'Guardar cambios', en: 'Save changes' },
  editingBoundary: { es: 'Mueve los puntos del contorno y guarda los cambios.', en: 'Move the boundary points and save your changes.' },
  saved: { es: 'Huerta guardada correctamente.', en: 'Orchard saved successfully.' },
  saveError: { es: 'No se pudo guardar la huerta.', en: 'The orchard could not be saved.' },
  loadError: { es: 'No se pudieron cargar tus huertas.', en: 'Your orchards could not be loaded.' },
  tableMissing: { es: 'Falta crear la tabla huertas en Supabase. Ejecuta la migración SQL incluida en el proyecto.', en: 'The orchards table is missing in Supabase. Run the SQL migration included in the project.' },
  nameRequired: { es: 'Escribe un nombre para la huerta.', en: 'Enter a name for the orchard.' },
  invalidBoundary: { es: 'Marca al menos tres puntos antes de guardar.', en: 'Mark at least three points before saving.' },
  deleteTitle: { es: 'Eliminar huerta', en: 'Delete orchard' },
  deleteBody: { es: '¿Quieres eliminar “{name}”? Esta acción no se puede deshacer.', en: 'Delete “{name}”? This action cannot be undone.' },
  deleting: { es: 'Eliminando…', en: 'Deleting…' },
  cancel: { es: 'Cancelar', en: 'Cancel' },
  delete: { es: 'Eliminar', en: 'Delete' },
  area: { es: '{area} ha', en: '{area} ha' },
  currentOrchard: { es: 'HUERTA SELECCIONADA', en: 'SELECTED ORCHARD' },
  openOrchards: { es: 'Abrir tus huertas', en: 'Open your orchards' },
  savePermissionTitle: { es: 'Guardar datos de esta huerta', en: 'Save this orchard’s data' },
  savePermissionBody: {
    es: 'Avotex guardará en tu cuenta el nombre de la huerta, su delimitación geográfica, ubicación central y superficie calculada. Estos datos se almacenan de forma remota en Supabase para que puedas consultar y editar tus huertas en la app. No se venden ni se usan con fines publicitarios. Puedes eliminar la huerta posteriormente desde “Tus huertas”.',
    en: 'Avotex will save the orchard name, geographic boundary, center location, and calculated area to your account. This data is stored remotely in Supabase so you can view and edit your orchards in the app. It is not sold or used for advertising. You can delete the orchard later from “Your orchards”.',
  },
  savePermissionNote: { es: 'Al continuar, autorizas guardar esta información.', en: 'By continuing, you authorize this information to be saved.' },
  authorizeSave: { es: 'Autorizar y guardar', en: 'Authorize and save' },
  details: { es: 'Comentarios sobre tu huerta', en: 'Comments about your orchard' },
  detailsPlaceholder: { es: 'Agrega información, notas o una descripción…', en: 'Add information, notes, or a description…' },
  editComments: { es: 'Comentarios', en: 'Comments' },
  commentsTitle: { es: 'Comentarios de la huerta', en: 'Orchard comments' },
  commentsSaved: { es: 'Comentarios actualizados.', en: 'Comments updated.' },
  zoneData: { es: 'DATOS DE LA ZONA', en: 'ZONE DATA' },
  surface: { es: 'Superficie', en: 'Surface' },
  perimeter: { es: 'Perímetro', en: 'Perimeter' },
  vertices: { es: 'Vértices', en: 'Vertices' },
  savedContour: { es: 'Huerta guardada', en: 'Saved orchard' },
  newContour: { es: 'Contorno nuevo', en: 'New outline' },
};

const EARTH_RADIUS_METERS = 6371000;

const polygonMetrics = (points: PolygonPoint[]) => {
  if (points.length < 3) return { areaM2: 0, perimeterM: 0 };
  const averageLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const latitudeScale = Math.cos(averageLatitude * Math.PI / 180);
  const projected = points.map(point => ({
    x: EARTH_RADIUS_METERS * point.longitude * Math.PI / 180 * latitudeScale,
    y: EARTH_RADIUS_METERS * point.latitude * Math.PI / 180,
  }));

  let signedArea = 0;
  let perimeterM = 0;
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    signedArea += projected[index].x * projected[nextIndex].y - projected[nextIndex].x * projected[index].y;

    const latitudeDelta = (points[nextIndex].latitude - points[index].latitude) * Math.PI / 180;
    const longitudeDelta = (points[nextIndex].longitude - points[index].longitude) * Math.PI / 180;
    const startLatitude = points[index].latitude * Math.PI / 180;
    const endLatitude = points[nextIndex].latitude * Math.PI / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    perimeterM += 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  return { areaM2: Math.abs(signedArea) / 2, perimeterM };
};

const orchardLocation = (orchard: Orchard): Location.LocationObject => ({
  coords: {
    latitude: orchard.center_lat,
    longitude: orchard.center_lng,
    altitude: null,
    accuracy: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
});

export default function Mapping() {
  const t = useTranslations(mappingTranslations);
  const { locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  useFonts({ Poppins_400Regular });
  const mapRef = useRef<PolygonMapHandle>(null);
  const selectedOrchardRef = useRef<string | null>(null);
  const saveEditedPolygonRef = useRef(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [gpsLocation, setGpsLocation] = useState<Location.LocationObject | null>(null);
  const [locationTitle, setLocationTitle] = useState(t('searching'));
  const [locationDetail, setLocationDetail] = useState(t('preciseReading'));
  const [notice, setNotice] = useState<string | null>(t('gettingPrecise'));
  const [polygon, setPolygon] = useState<PolygonPoint[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [orchards, setOrchards] = useState<Orchard[]>([]);
  const [selectedOrchard, setSelectedOrchard] = useState<Orchard | null>(null);
  const [orchardName, setOrchardName] = useState('');
  const [orchardDetails, setOrchardDetails] = useState('');
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [orchardPendingDelete, setOrchardPendingDelete] = useState<Orchard | null>(null);
  const [deletingOrchard, setDeletingOrchard] = useState(false);
  const [loadingOrchards, setLoadingOrchards] = useState(false);
  const [savingOrchard, setSavingOrchard] = useState(false);
  const [orchardsError, setOrchardsError] = useState<string | null>(null);
  const [orchardsOpen, setOrchardsOpen] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const [editingBoundary, setEditingBoundary] = useState(false);
  const [drawingNewBoundary, setDrawingNewBoundary] = useState(false);
  const [savePermissionVisible, setSavePermissionVisible] = useState(false);
  const [pendingSaveMode, setPendingSaveMode] = useState<'boundary' | 'edit'>('boundary');
  const calculatedMetrics = useMemo(() => polygonMetrics(polygon), [polygon]);
  const displayedAreaM2 = selectedOrchard && !editingBoundary
    ? selectedOrchard.area_m2
    : calculatedMetrics.areaM2;
  const visiblePointCount = drawingNewBoundary ? 0 : polygon.length;
  const areaDisplay = displayedAreaM2 >= 10000
    ? `${(displayedAreaM2 / 10000).toFixed(2)} ha`
    : `${Math.round(displayedAreaM2).toLocaleString(locale)} m²`;
  const perimeterDisplay = calculatedMetrics.perimeterM >= 1000
    ? `${(calculatedMetrics.perimeterM / 1000).toFixed(2)} km`
    : `${Math.round(calculatedMetrics.perimeterM)} m`;
  const zoneCallout = useMemo(() => {
    if (polygon.length < 3 || drawingNewBoundary) return undefined;
    return {
      title: selectedOrchard?.nombre || orchardName.trim() || t('zone'),
      rows: [
        { label: t('surface'), value: areaDisplay },
        { label: t('perimeter'), value: perimeterDisplay },
        { label: t('vertices'), value: String(polygon.length) },
      ],
    };
  }, [
    areaDisplay,
    drawingNewBoundary,
    orchardName,
    perimeterDisplay,
    polygon.length,
    selectedOrchard?.nombre,
    t,
  ]);

  const loadUserOrchards = useCallback(async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    setLoadingOrchards(true);
    setOrchardsError(null);
    try {
      setOrchards(await listOrchards(email));
    } catch (error: any) {
      const missing = error?.code === '42P01' || error?.code === 'PGRST205' || String(error?.message).includes('huertas');
      setOrchardsError(missing ? t('tableMissing') : t('loadError'));
    } finally {
      setLoadingOrchards(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    loadUserOrchards();
  }, [loadUserOrchards]));

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
          setGpsLocation(current);
          if (!selectedOrchardRef.current) setLocation(current);
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

  const selectOrchard = (orchard: Orchard) => {
    selectedOrchardRef.current = orchard.id;
    setSelectedOrchard(orchard);
    setOrchardName(orchard.nombre);
    setOrchardDetails(orchard.detalles ?? '');
    setPolygon(orchard.coordinates);
    setLocation(orchardLocation(orchard));
    setLocationTitle(orchard.nombre);
    setLocationDetail(t('area', { area: (orchard.area_m2 / 10000).toFixed(2) }));
    setNotice(t('boundaryReady'));
    setPreviewVisible(false);
    setEditingBoundary(false);
    setDrawingNewBoundary(false);
    setOrchardsOpen(false);
    setMapVersion(value => value + 1);
  };

  const createNewOrchard = () => {
    selectedOrchardRef.current = null;
    setSelectedOrchard(null);
    setOrchardName('');
    setOrchardDetails('');
    setPolygon([]);
    if (gpsLocation) setLocation(gpsLocation);
    setLocationTitle(t('current'));
    if (gpsLocation) {
      setLocationDetail(`${gpsLocation.coords.latitude.toFixed(5)}, ${gpsLocation.coords.longitude.toFixed(5)}`);
    }
    setNotice(t('tapCorners'));
    setPreviewVisible(false);
    setEditingBoundary(false);
    setDrawingNewBoundary(false);
    setOrchardsOpen(false);
    setMapVersion(value => value + 1);
  };

  const startNewBoundary = () => {
    if (selectedOrchardRef.current) {
      selectedOrchardRef.current = null;
      setSelectedOrchard(null);
      setOrchardName('');
      setOrchardDetails('');
      setLocationTitle(t('current'));
      if (location) {
        setLocationDetail(`${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`);
      }
    }
    setEditingBoundary(false);
    setDrawingNewBoundary(true);
    mapRef.current?.startFreshDrawing();
    setNotice(t('drawInstruction'));
  };

  const persistOrchard = async (pointsToSave: PolygonPoint[] = polygon) => {
    const email = auth.currentUser?.email;
    if (!email) return;
    if (!orchardName.trim()) {
      setNotice(t('nameRequired'));
      return;
    }
    if (pointsToSave.length < 3) {
      setNotice(t('invalidBoundary'));
      return;
    }
    setSavingOrchard(true);
    try {
      const saved = await saveOrchard({
        id: selectedOrchard?.id,
        userEmail: email,
        name: orchardName,
        details: orchardDetails,
        coordinates: pointsToSave,
      });
      setOrchards(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      selectedOrchardRef.current = saved.id;
      setSelectedOrchard(saved);
      setOrchardDetails(saved.detalles ?? '');
      setLocation(orchardLocation(saved));
      setLocationTitle(saved.nombre);
      setLocationDetail(t('area', { area: (saved.area_m2 / 10000).toFixed(2) }));
      setNotice(t('saved'));
      setPreviewVisible(false);
      setMapVersion(value => value + 1);
    } catch (error: any) {
      const missing = error?.code === '42P01' || error?.code === 'PGRST205' || String(error?.message).includes('huertas');
      setNotice(missing ? t('tableMissing') : error?.message || t('saveError'));
    } finally {
      setSavingOrchard(false);
    }
  };

  const requestSavePermission = (mode: 'boundary' | 'edit') => {
    if (!orchardName.trim()) {
      setNotice(t('nameRequired'));
      return;
    }
    if (polygon.length < 3) {
      setNotice(t('invalidBoundary'));
      return;
    }
    setPendingSaveMode(mode);
    if (mode === 'boundary') setPreviewVisible(false);
    setSavePermissionVisible(true);
  };

  const cancelSavePermission = () => {
    setSavePermissionVisible(false);
    if (pendingSaveMode === 'boundary') setPreviewVisible(true);
  };

  const authorizeAndSave = () => {
    setSavePermissionVisible(false);
    if (pendingSaveMode === 'edit') {
      saveEditedPolygonRef.current = true;
      setEditingBoundary(false);
      mapRef.current?.finishEditing();
      return;
    }
    void persistOrchard();
  };

  const confirmDeleteOrchard = (orchard: Orchard) => {
    setOrchardPendingDelete(orchard);
  };

  const performDeleteOrchard = async () => {
    if (!orchardPendingDelete || deletingOrchard) return;
    const email = auth.currentUser?.email;
    if (!email) return;
    setDeletingOrchard(true);
    try {
      await deleteOrchard(orchardPendingDelete.id, email);
      setOrchards(current => current.filter(item => item.id !== orchardPendingDelete.id));
      if (selectedOrchard?.id === orchardPendingDelete.id) createNewOrchard();
      setOrchardPendingDelete(null);
    } catch (error: any) {
      setNotice(error?.message || t('saveError'));
    } finally {
      setDeletingOrchard(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.mapLayer}>
        {locationEnabled && location ? (
          <PolygonMap
            key={`map-${mapVersion}`}
            ref={mapRef}
            location={location}
            initialPolygon={polygon}
            perspective={Boolean(selectedOrchard) && !editingBoundary}
            zoneCallout={zoneCallout}
            onPolygonChange={(points: PolygonPoint[]) => {
              setPolygon(points);
              if (points.length >= 3 || points.length === 0) setDrawingNewBoundary(false);
              if (saveEditedPolygonRef.current) {
                saveEditedPolygonRef.current = false;
                void persistOrchard(points);
                return;
              }
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

      <View style={[styles.locationCard, isWide && styles.locationCardWide]}>
        <View style={styles.locationIcon}>
          <Navigation size={20} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        <View style={styles.locationCopy}>
            <Text style={styles.locationEyebrow}>{selectedOrchard ? t('currentOrchard') : t('eyebrow')}</Text>
          <Text style={styles.locationCardTitle} numberOfLines={1}>{locationTitle}</Text>
          <Text style={styles.locationCardDetail} numberOfLines={1}>{locationDetail}</Text>
        </View>
        <MapPin size={19} color="#9EE7D2" />
      </View>

      {!isWide && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('openOrchards')}
          onPress={() => setOrchardsOpen(value => !value)}
          style={({ pressed }) => [styles.mobileOrchardsButton, pressed && styles.actionPressed]}
        >
          <Sprout size={17} color="#FFFFFF" />
          <Text style={styles.mobileOrchardsButtonText}>{t('orchards')}</Text>
          <ChevronRight size={16} color="#9EE7D2" />
        </Pressable>
      )}

      {(isWide || orchardsOpen) && (
        <View style={[styles.orchardsPanel, !isWide && styles.orchardsPanelMobile]}>
          <View style={styles.orchardsHeader}>
            <View>
              <Text style={styles.orchardsEyebrow}>AVOTEX</Text>
              <Text style={styles.orchardsTitle}>{t('orchards')}</Text>
            </View>
            {!isWide && (
              <Pressable onPress={() => setOrchardsOpen(false)} style={styles.panelClose}>
                <X size={16} color="#173E36" />
              </Pressable>
            )}
          </View>
          <Pressable onPress={createNewOrchard} style={({ pressed }) => [styles.newOrchardButton, pressed && styles.actionPressed]}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.newOrchardButtonText}>{t('newOrchard')}</Text>
          </Pressable>
          {loadingOrchards ? (
            <ActivityIndicator color="#0D756B" style={styles.orchardsLoader} />
          ) : orchardsError ? (
            <Text style={styles.orchardsError}>{orchardsError}</Text>
          ) : orchards.length === 0 ? (
            <View style={styles.emptyOrchards}>
              <Sprout size={24} color="#70A496" />
              <Text style={styles.emptyOrchardsTitle}>{t('noOrchards')}</Text>
              <Text style={styles.emptyOrchardsText}>{t('createFirst')}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.orchardsList}>
              {orchards.map(orchard => (
                <View
                  key={orchard.id}
                  style={[
                    styles.orchardRow,
                    selectedOrchard?.id === orchard.id && styles.orchardRowSelected,
                  ]}
                >
                  <Pressable
                    onPress={() => selectOrchard(orchard)}
                    style={({ pressed }) => [styles.orchardSelectArea, pressed && styles.actionPressed]}
                  >
                    <View style={styles.orchardIcon}><Sprout size={15} color="#0D756B" /></View>
                    <View style={styles.orchardCopy}>
                      <Text style={styles.orchardName} numberOfLines={1}>{orchard.nombre}</Text>
                      <Text style={styles.orchardArea}>{t('area', { area: (orchard.area_m2 / 10000).toFixed(2) })}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('delete')}
                    onPress={() => confirmDeleteOrchard(orchard)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.orchardDeleteButton, pressed && styles.actionPressed]}
                  >
                    <Trash2 size={15} color="#B45B54" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {selectedOrchard && (
        <Pressable
          onPress={() => setCommentsVisible(true)}
          style={({ pressed }) => [styles.commentsFloatingButton, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('editComments')}
        >
          <MessageSquareText size={19} color="#FFFFFF" />
          <Text style={styles.commentsFloatingText}>{t('editComments')}</Text>
        </Pressable>
      )}

      <BlurView intensity={55} tint="light" style={[styles.bottomPanel, isWide && styles.bottomPanelWide]}>
        <View style={styles.panelCopy}>
          <View>
           <Text style={styles.title}>{t('title')}</Text>
          </View>
          <View style={styles.panelHeaderActions}>
            {visiblePointCount > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('eraseLabel')}
                onPress={() => {
                  setEditingBoundary(false);
                   setDrawingNewBoundary(false);
                  mapRef.current?.clearDrawing();
                  setPolygon([]);
                  setNotice(t('cleared'));
                }}
                style={({ pressed }) => [styles.headerEraseButton, pressed && styles.actionPressed]}
              >
                <Eraser size={15} color="#D1534A" />
                <Text style={styles.headerEraseLabel}>{t('erase')}</Text>
              </Pressable>
            )}
            <View style={[styles.pointBadge, visiblePointCount >= 3 && styles.pointBadgeReady]}>
              <Text style={[styles.pointBadgeText, visiblePointCount >= 3 && styles.pointBadgeTextReady]}>
                {t('points', { count: visiblePointCount })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
                 accessibilityLabel={t('drawLabel')}
            accessibilityState={{ disabled: !location }}
            disabled={!location}
             onPress={startNewBoundary}
            style={({ pressed }) => [
              styles.actionButton,
              !location && styles.actionButtonDisabled,
              pressed && styles.actionPressed,
            ]}
          >
            <Pencil size={20} color="#176B62" />
             <Text style={styles.actionLabel}>{t('draw')}</Text>
          </Pressable>

          {selectedOrchard && visiblePointCount >= 3 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('editBoundary')}
              onPress={() => {
                mapRef.current?.editDrawing();
                setEditingBoundary(true);
                setNotice(t('editingBoundary'));
              }}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
            >
              <Pencil size={20} color="#176B62" />
              <Text style={styles.actionLabel}>{t('editBoundary')}</Text>
            </Pressable>
          )}

          {!selectedOrchard && visiblePointCount >= 3 && !editingBoundary && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('saveLabel')}
              onPress={() => setPreviewVisible(true)}
              style={({ pressed }) => [styles.actionButton, styles.saveChangesButton, pressed && styles.actionPressed]}
            >
              <Save size={20} color="#FFFFFF" />
              <Text style={[styles.actionLabel, styles.saveChangesLabel]}>{t('save')}</Text>
            </Pressable>
          )}

          {editingBoundary && selectedOrchard && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('saveChanges')}
              disabled={savingOrchard}
              onPress={() => {
                requestSavePermission('edit');
              }}
              style={({ pressed }) => [
                styles.actionButton,
                styles.saveChangesButton,
                savingOrchard && styles.actionButtonDisabled,
                pressed && styles.actionPressed,
              ]}
            >
              {savingOrchard ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={20} color="#FFFFFF" />}
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[styles.actionLabel, styles.saveChangesLabel]}
              >
                {t('saveChanges')}
              </Text>
            </Pressable>
          )}

        </View>
      </BlurView>

      <Modal
        visible={savePermissionVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={cancelSavePermission}
      >
        <View style={styles.permissionBackdrop}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <ShieldCheck size={28} color="#0D756B" />
            </View>
            <Text style={styles.permissionTitle}>{t('savePermissionTitle')}</Text>
            <Text style={styles.permissionBody}>{t('savePermissionBody')}</Text>
            <Text style={styles.permissionNote}>{t('savePermissionNote')}</Text>
            <View style={styles.permissionActions}>
              <Pressable onPress={cancelSavePermission} style={({ pressed }) => [styles.permissionCancel, pressed && styles.actionPressed]}>
                <Text style={styles.permissionCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={authorizeAndSave} style={({ pressed }) => [styles.permissionConfirm, pressed && styles.saveButtonPressed]}>
                <ShieldCheck size={17} color="#FFFFFF" />
                <Text style={styles.permissionConfirmText}>{t('authorizeSave')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
        >
          <View style={styles.previewBackdrop}>
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
                  zoneCallout={zoneCallout}
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

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              value={orchardName}
              onChangeText={setOrchardName}
              placeholder={t('orchardPlaceholder')}
              placeholderTextColor="#8A9995"
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={() => requestSavePermission('boundary')}
              style={styles.orchardNameInput}
              accessibilityLabel={t('orchardName')}
            />
            <TextInput
              value={orchardDetails}
              onChangeText={setOrchardDetails}
              placeholder={t('detailsPlaceholder')}
              placeholderTextColor="#8A9995"
              maxLength={1000}
              multiline
              textAlignVertical="top"
              style={[styles.orchardNameInput, styles.orchardDetailsInput]}
              accessibilityLabel={t('details')}
            />

            <Pressable
              accessibilityRole="button"
               accessibilityLabel={t('saveLabel')}
               onPress={() => requestSavePermission('boundary')}
               disabled={savingOrchard}
               style={({ pressed }) => [styles.previewSaveButton, savingOrchard && styles.actionButtonDisabled, pressed && styles.saveButtonPressed]}
            >
              {savingOrchard ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={18} color="#FFFFFF" />}
               <Text style={styles.previewSaveButtonText}>{t('save')}</Text>
            </Pressable>
            </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={commentsVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCommentsVisible(false)}>
        <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.permissionBackdrop}>
            <View style={styles.permissionCard}>
              <View style={styles.commentsModalHeader}>
                <Text style={styles.permissionTitle}>{t('commentsTitle')}</Text>
                <Pressable onPress={() => setCommentsVisible(false)} style={styles.previewClose}><X size={19} color="#173E36" /></Pressable>
              </View>
              <TextInput
                value={orchardDetails}
                onChangeText={setOrchardDetails}
                placeholder={t('detailsPlaceholder')}
                placeholderTextColor="#8A9995"
                maxLength={1000}
                multiline
                autoFocus
                textAlignVertical="top"
                style={[styles.orchardNameInput, styles.commentsModalInput]}
              />
              <Pressable
                style={styles.previewSaveButton}
                disabled={savingOrchard}
                onPress={async () => {
                  await persistOrchard();
                  setCommentsVisible(false);
                }}
              >
                {savingOrchard ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={18} color="#FFFFFF" />}
                <Text style={styles.previewSaveButtonText}>{t('saveChanges')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={orchardPendingDelete !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !deletingOrchard && setOrchardPendingDelete(null)}
      >
        <View style={styles.permissionBackdrop}>
          <View style={styles.permissionCard}>
            <View style={styles.deleteModalIcon}>
              <Trash2 size={26} color="#B94C44" />
            </View>
            <Text style={styles.permissionTitle}>{t('deleteTitle')}</Text>
            <Text style={styles.permissionBody}>
              {t('deleteBody', { name: orchardPendingDelete?.nombre ?? '' })}
            </Text>
            <View style={styles.permissionActions}>
              <Pressable
                disabled={deletingOrchard}
                onPress={() => setOrchardPendingDelete(null)}
                style={({ pressed }) => [styles.permissionCancel, pressed && styles.actionPressed]}
              >
                <Text style={styles.permissionCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                disabled={deletingOrchard}
                onPress={performDeleteOrchard}
                style={({ pressed }) => [styles.deleteConfirmButton, pressed && styles.actionPressed]}
              >
                {deletingOrchard
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Trash2 size={17} color="#FFFFFF" />}
                <Text style={styles.deleteConfirmText}>
                  {deletingOrchard ? t('deleting') : t('delete')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  locationCardWide: { right: 306 },
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
  bottomPanelWide: { right: 306 },
  mobileOrchardsButton: {
    position: 'absolute',
    top: 112,
    right: 18,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(5,7,7,0.94)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 9,
  },
  mobileOrchardsButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  orchardsPanel: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 270,
    maxHeight: 430,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#102D27',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 14,
  },
  orchardsPanelMobile: {
    top: 158,
    right: 14,
    width: 250,
    maxHeight: 340,
  },
  orchardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  orchardsEyebrow: { color: '#70A496', fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  orchardsTitle: { color: '#112B26', fontSize: 19, lineHeight: 24, fontWeight: '800' },
  panelClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4F2',
  },
  newOrchardButton: {
    minHeight: 42,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#0D756B',
  },
  newOrchardButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  orchardsLoader: { marginVertical: 28 },
  orchardsError: { color: '#A64A43', fontSize: 10, lineHeight: 15, marginTop: 13 },
  emptyOrchards: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 23 },
  emptyOrchardsTitle: { color: '#25443D', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  emptyOrchardsText: { color: '#738A84', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 3 },
  orchardsList: { marginTop: 9 },
  orchardRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E3ECE9',
    backgroundColor: '#F8FBFA',
  },
  orchardRowSelected: { borderColor: '#85CDBA', backgroundColor: '#E5F5F0' },
  orchardSelectArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  orchardDeleteButton: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FCECEB',
  },
  orchardIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    backgroundColor: '#DDF1EB',
  },
  orchardCopy: { flex: 1, minWidth: 0, marginRight: 6 },
  orchardName: { color: '#173E36', fontSize: 11, fontWeight: '800' },
  orchardArea: { color: '#70847F', fontSize: 9, marginTop: 2 },
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
  panelHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerEraseButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFF0EE',
  },
  headerEraseLabel: { color: '#B94C44', fontSize: 10, fontWeight: '800' },
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
  saveChangesButton: { backgroundColor: '#0D756B' },
  saveChangesLabel: { color: '#FFFFFF', maxWidth: '100%', textAlign: 'center', lineHeight: 11 },
  saveButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  keyboardAvoiding: { flex: 1 },
  permissionBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(8,18,15,0.62)',
  },
  permissionCard: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 19,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 24,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: '#DDF4EC',
  },
  permissionTitle: {
    color: '#132E28',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionBody: {
    marginTop: 11,
    color: '#536B65',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
  },
  permissionNote: {
    marginTop: 11,
    color: '#173E36',
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  permissionCancel: {
    flex: 0.8,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF3F1',
  },
  permissionCancelText: { color: '#455E58', fontSize: 11, fontWeight: '800' },
  permissionConfirm: {
    flex: 1.5,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#0D756B',
  },
  permissionConfirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
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
  orchardNameInput: {
    minHeight: 46,
    marginTop: 13,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DDE7E4',
    color: '#173E36',
    fontSize: 12,
    backgroundColor: '#F5F9F8',
  },
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
  orchardDetailsInput: { minHeight: 88, paddingTop: 12 },
  commentsFloatingButton: {
    position: 'absolute', left: 18, top: 112, minHeight: 38, paddingHorizontal: 12,
    borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#0D756B', shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 10,
  },
  commentsFloatingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  commentsModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentsModalInput: { minHeight: 150, paddingTop: 13, marginTop: 18 },
  deleteModalIcon: {
    width: 54, height: 54, borderRadius: 18, alignSelf: 'center', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14, backgroundColor: '#FCECEB',
  },
  deleteConfirmButton: {
    flex: 1.2, minHeight: 48, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#B94C44',
  },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});