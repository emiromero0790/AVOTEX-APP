

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AccessibilityContextType {
  isColorblindMode: boolean;
  toggleColorblindMode: () => void;
}

// Creamos el contexto
const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [isColorblindMode, setIsColorblindMode] = useState(false);

  const toggleColorblindMode = () => {
    setIsColorblindMode(previousState => !previousState);
  };

  return (
    <AccessibilityContext.Provider value={{ isColorblindMode, toggleColorblindMode }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};