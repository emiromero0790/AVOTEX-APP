import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { User } from 'firebase/auth';

interface AvatarProps {
  user: User | null;
}

export default function Avatar({ user }: AvatarProps) {
  if (!user) return null;

  if (user.photoURL) {
    return (
      <Image
        source={{ uri: user.photoURL }}
        style={styles.avatarImage}
      />
    );
  }

  const initial = user.email ? user.email[0].toUpperCase() : '?';

  return (
    <View style={styles.avatarInitialContainer}>
      <Text style={styles.avatarInitialText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25, 
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarInitialContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#c8e6c9', 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarInitialText: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold', 
    color: '#2e7d32',
  },
});