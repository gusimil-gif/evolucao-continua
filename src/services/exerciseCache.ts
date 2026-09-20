import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { firestoreExercises } from '../utils/firestoreExercises';
import { getExerciseVideoUrl } from '../utils/videoHelper';
import type { Exercise } from '../types';

const CACHE_KEY = 'ec_exercises_cache_v2';
let memoryCache: Exercise[] | null = null;
let isFetchingRemote = false;

type CacheListener = (exercises: Exercise[]) => void;
const listeners = new Set<CacheListener>();

export function subscribeExerciseCache(listener: CacheListener): () => void {
  listeners.add(listener);
  if (memoryCache && memoryCache.length > 0) {
    listener(memoryCache);
  }
  return () => listeners.delete(listener);
}

// Converte os dados verificados do Firestore para o formato Exercise padrão com links de vídeo garantidos
const defaultExercises: Exercise[] = firestoreExercises.map(ex => {
  const resolvedVideo = getExerciseVideoUrl(ex.nome, ex.videoUrl);
  return {
    ...ex,
    videoUrl: resolvedVideo,
    videoUrlPadrao: ex.videoUrlPadrao || resolvedVideo,
    ativo: ex.ativo !== false
  };
});

/**
 * Retorna lista de exercícios instantaneamente (<1ms) a partir de:
 * 1. Memória RAM (se já carregado)
 * 2. LocalStorage (se persistido no navegador)
 * 3. Catálogo oficial sincronizado com os 127 IDs do Firestore
 *
 * Dispara atualização em background no Firestore para sincronizar novos exercícios cadastrados.
 */
export async function getExercisesCached(): Promise<Exercise[]> {
  // 1. Se já está na memória, retorna de imediato
  if (memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }

  // 2. Se está no LocalStorage, recupera instantaneamente
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Exercise[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache = parsed;
          // Revalida em segundo plano sem bloquear a interface
          revalidateRemote();
          return memoryCache;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback imediato com os 127 exercícios oficiais com IDs reais
  memoryCache = defaultExercises;
  revalidateRemote();
  return memoryCache;
}

/**
 * Sincroniza em segundo plano com o Firestore e atualiza o cache
 */
async function revalidateRemote() {
  if (isFetchingRemote) return;
  isFetchingRemote = true;

  try {
    const snap = await getDocs(collection(db, 'exercises'));
    if (!snap.empty) {
      const remoteDocs = snap.docs.map(d => {
        const data = d.data();
        const safeVideo = getExerciseVideoUrl(data.nome, data.videoUrl);
        return {
          exerciseId: d.id,
          ...data,
          videoUrl: safeVideo,
          videoUrlPadrao: data.videoUrlPadrao || safeVideo
        };
      }) as Exercise[];

      remoteDocs.sort((a, b) => {
        if (a.grupoMuscular < b.grupoMuscular) return -1;
        if (a.grupoMuscular > b.grupoMuscular) return 1;
        return a.nome.localeCompare(b.nome);
      });

      memoryCache = remoteDocs;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(remoteDocs));
        } catch (_) {}
      }

      // Notificar componentes inscritos
      listeners.forEach(cb => {
        try {
          cb(remoteDocs);
        } catch (_) {}
      });
    }
  } catch (err) {
    console.warn('Revalidação em segundo plano de exercícios falhou (usando cache local):', err);
  } finally {
    isFetchingRemote = false;
  }
}

/**
 * Invalida o cache após criação/edição/exclusão de exercícios
 */
export function invalidateExerciseCache() {
  memoryCache = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
  }
}
