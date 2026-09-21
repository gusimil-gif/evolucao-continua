/**
 * Serviço de Cache Ultrarrápido SWR (Stale-While-Revalidate)
 * Garante carregamento em 0ms (<10ms) ao abrir o app, hidratando
 * o estado de forma síncrona a partir do armazenamento local persistente.
 */

export interface CachedClientDashboard {
  activePlan: any | null;
  allWorkouts: any[];
  todayWorkout: any | null;
  streak: number;
  monthTotal: number;
  habits: { water: boolean; diet: boolean; sleep: boolean };
  cachedAt: number;
}

export function getCachedDashboard(uid: string): CachedClientDashboard | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`ec_dash_cache_v2_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedDashboard(uid: string, data: Omit<CachedClientDashboard, 'cachedAt'>) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    const payload: CachedClientDashboard = {
      ...data,
      cachedAt: Date.now()
    };
    localStorage.setItem(`ec_dash_cache_v2_${uid}`, JSON.stringify(payload));
  } catch {
    // QuotaExceeded ou navegação anônima segura
  }
}
