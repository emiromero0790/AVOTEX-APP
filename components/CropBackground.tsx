import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export interface OrbConfig {
  name: string;
  uri: string;
  color: string;
  glow: string;
  x: number;
  y: number;
  size: number;
  dur: number;
  delay: number;
  fy: number;
  fx: number;
}

export interface DotConfig {
  x: number;
  y: number;
  r: number;
  c: string;
}

interface Props {
  orbs: OrbConfig[];
  dots?: DotConfig[];
  gradientColors: [string, string, string];
  gradientLocations?: [number, number, number];
  vignetteOpacity?: number;
}

const FloatingOrb = ({ orb }: { orb: OrbConfig }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: orb.dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: orb.dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, orb.delay);
    return () => clearTimeout(t);
  }, []);

  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, orb.fy] });
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, orb.fx] });
  const sc = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.025, 1] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: orb.x,
        top: orb.y,
        width: orb.size,
        height: orb.size,
        transform: [{ translateY: ty }, { translateX: tx }, { scale: sc }],
        zIndex: 0,
      }}
    >
      <View style={{
        position: 'absolute',
        top: -8, left: -8,
        width: orb.size + 16, height: orb.size + 16,
        borderRadius: (orb.size + 16) / 2,
        backgroundColor: orb.glow,
      }} />
      <View style={{
        position: 'absolute',
        top: -4, left: -4,
        width: orb.size + 8, height: orb.size + 8,
        borderRadius: (orb.size + 8) / 2,
        borderWidth: 3,
        borderColor: orb.color + 'aa',
      }} />
      <Image
        source={{ uri: orb.uri }}
        style={{
          width: orb.size,
          height: orb.size,
          borderRadius: orb.size / 2,
          opacity: 0.82,
        }}
      />
      <View style={{
        position: 'absolute',
        top: 0, left: 0,
        width: orb.size, height: orb.size,
        borderRadius: orb.size / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }} />
    </Animated.View>
  );
};

export const W = width;
export const H = height;

export default function CropBackground({ orbs, dots = [], gradientColors, gradientLocations = [0, 0.38, 1], vignetteOpacity = 0.28 }: Props) {
  return (
    <>
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={StyleSheet.absoluteFill}
      />
      {/* Decorative dots */}
      <View style={s.layer} pointerEvents="none">
        {dots.map((dot, i) => (
          <View key={i} style={{
            position: 'absolute',
            left: dot.x * width,
            top: dot.y * height,
            width: dot.r * 2, height: dot.r * 2,
            borderRadius: dot.r,
            backgroundColor: dot.c,
          }} />
        ))}
      </View>
      {/* Crop orbs */}
      <View style={s.layer} pointerEvents="none">
        {orbs.map(orb => <FloatingOrb key={orb.name} orb={orb} />)}
      </View>
      {/* Center frosted vignette */}
      <View style={[s.vignette, { backgroundColor: `rgba(255,255,255,${vignetteOpacity})` }]} pointerEvents="none" />
    </>
  );
}

const s = StyleSheet.create({
  layer: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', zIndex: 0 },
  vignette: {
    position: 'absolute',
    top: '12%', left: '6%',
    width: '88%', height: '76%',
    borderRadius: 999,
    zIndex: 1,
  },
});
