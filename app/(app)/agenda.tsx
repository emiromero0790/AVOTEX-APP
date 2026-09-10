import React from 'react';
import { Redirect } from 'expo-router';

/** Compatibility route: activity planning now lives in the unified Activity center. */
export default function AgendaScreen() {
  return <Redirect href="/(app)/results?view=plan" />;
}