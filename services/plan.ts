/**
 * Plan del usuario y tokens incluidos al mes, para el anillo de uso (components/TokenRing.tsx).
 *
 * Los montos son los mismos que muestra la pantalla de Planes (app/(app)/plans.tsx) y están en las
 * mismas unidades que ve el usuario (users.tokens × 100).
 * El plan se lee de users.plan_suscripcion; se aceptan variantes de texto («Pro Satelital», «pro»,
 * «Básico», «basic», «free», vacío…). Sin plan reconocible se usa Free.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseConfig';

export type PlanKey = 'free' | 'basic' | 'pro';

export const PLAN_TOKENS: Record<PlanKey, number> = { free: 2500, basic: 45000, pro: 250000 };
export const PLAN_NAME: Record<PlanKey, { es: string; en: string }> = {
  free: { es: 'Free', en: 'Free' },
  basic: { es: 'Básico', en: 'Basic' },
  pro: { es: 'Pro Satelital', en: 'Satellite Pro' },
};

export function planKeyOf(raw: string | null | undefined): PlanKey {
  const v = (raw ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v.includes('pro') || v.includes('satel')) return 'pro';
  if (v.includes('basic') || v.includes('basico')) return 'basic';
  return 'free';
}

const cache = new Map<string, PlanKey>();

/** Plan del usuario (se consulta una vez por sesión y se reutiliza en todas las pantallas). */
export function usePlan(email: string | null | undefined): PlanKey | null {
  const [plan, setPlan] = useState<PlanKey | null>(email ? cache.get(email) ?? null : null);
  useEffect(() => {
    if (!email) { setPlan(null); return; }
    if (cache.has(email)) { setPlan(cache.get(email)!); return; }
    let alive = true;
    Promise.resolve(supabase.from('users').select('plan_suscripcion').eq('user_email', email).maybeSingle())
      .then(({ data, error }) => {
        // Si la columna no existe o falla la consulta, se toma Free (no se inventa un plan mayor).
        const key = planKeyOf(error ? null : (data as { plan_suscripcion?: string | null } | null)?.plan_suscripcion);
        cache.set(email, key);
        if (alive) setPlan(key);
      })
      .catch(() => { if (alive) setPlan('free'); });
    return () => { alive = false; };
  }, [email]);
  return plan;
}

/**
 * Uso del mes: porcentaje usado del plan. Si quedan más tokens que los del plan (tokens extra o
 * plan sin identificar), el uso es 0 % y se indica en la tarjeta.
 */
export function usageOf(remaining: number, total: number): { usedPct: number; extra: boolean } {
  if (!(total > 0)) return { usedPct: 0, extra: false };
  if (remaining > total) return { usedPct: 0, extra: true };
  return { usedPct: Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100))), extra: false };
}
