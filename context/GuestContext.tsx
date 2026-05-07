import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_SCANS_KEY = 'guest_scans_remaining';
const GUEST_MAX_SCANS = 25;

interface GuestContextType {
  isGuest: boolean;
  guestScansLeft: number;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  decrementGuestScans: () => Promise<boolean>;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const GuestProvider = ({ children }: { children: ReactNode }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [guestScansLeft, setGuestScansLeft] = useState(GUEST_MAX_SCANS);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(GUEST_SCANS_KEY);
      if (stored !== null) {
        setGuestScansLeft(parseInt(stored, 10));
      }
    })();
  }, []);

  const enterGuestMode = () => {
    setIsGuest(true);
  };

  const exitGuestMode = async () => {
    setIsGuest(false);
    await AsyncStorage.removeItem(GUEST_SCANS_KEY);
    setGuestScansLeft(GUEST_MAX_SCANS);
  };

  const decrementGuestScans = async (): Promise<boolean> => {
    if (guestScansLeft <= 0) return false;
    const newCount = guestScansLeft - 1;
    setGuestScansLeft(newCount);
    await AsyncStorage.setItem(GUEST_SCANS_KEY, String(newCount));
    return true;
  };

  return (
    <GuestContext.Provider value={{ isGuest, guestScansLeft, enterGuestMode, exitGuestMode, decrementGuestScans }}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
};

export { GUEST_MAX_SCANS };
