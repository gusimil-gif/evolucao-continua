import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { exercisesData } from '../utils/exercisesData';
import type { Exercise } from '../types';

const CACHE_KEY = 'ec_exercises_cache_v1';
let memoryCache: Exercise[] | null = null;
let isFetchingRemote = false;

// Converte os dados estáticos para o formato Exercise padrão
const defaultExercises: Exercise[] = exercisesData.map((ex, index) => {
  const id = `ex_seed_${index}_${ex.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  return {
    exerciseId: id,
    nome: ex.nome,
    grupoMuscular: ex.grupoMuscular,
    equipamento: ex.equipamento,
    dificuldade: ex.dificuldade,
    descricao: '',
    videoUrl: ex.videoUrl,
    videoUrlPadrao: ex.videoUrl,
    criadoPor: 'system',
    ativo: true
  };
});

/**
 * Retorna lista de exercícios instantaneamente (<1ms) a partir de:
 * 1. Memória RAM (se já carregado)
 * 2. LocalStorage (se persistido no navegador)
 * 3. Catálogo estático embutido (157 exercícios padrão)
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

  // 3. Fallback imediato com os 157 exercícios estáticos
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
      const remoteDocs = snap.docs.map(d => ({
        exerciseId: d.id,
        ...d.data()
      })) as Exercise[];

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
