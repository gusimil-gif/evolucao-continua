export type UserType = 'trainer' | 'client';

export interface UserData {
  uid: string;
  userType: UserType;
  nome: string;
  dataNascimento: string;
  email: string;
  telefone: string;
  dataCriacao: any; // Timestamp
  ultimoAcesso: any; // Timestamp
  ativo: boolean;
  // Specific to Client
  trainerId?: string;
  metaFitness?: string;
  observacoes?: string;
}

export interface Exercise {
  exerciseId: string;
  nome: string;
  grupoMuscular: string;
  subgrupo?: string;
  equipamento: string;
  dificuldade: string;
  descricao: string;
  videoUrl: string;
  videoUrlPadrao: string;
  criadoPor: string;
  ativo: boolean;
}

export interface WorkoutPlan {
  planId: string;
  clientId: string;
  trainerId: string;
  nomePlano: string;
  descricao: string;
  dataCriacao: any;
  dataInicio: any;
  dataFim: any | null;
  ativo: boolean;
  diasDaSemana: string[];
}

export interface WorkoutDay {
  dayId: string;
  planId: string;
  diaSemana: string;
  nomeTreino: string;
  ordem: number;
  exercicios: ExerciseDetails[];
}

export interface ExerciseDetails {
  exerciseId: string;
  ordem: number;
  series: number;
  repeticoes: string;
  descanso: string;
  tipoExecucao: string;
  observacoes: string;
  tecnica: string;
}

export interface WorkoutLog {
  logId: string;
  clientId: string;
  dayId: string;
  planId: string;
  dataExecucao: any;
  concluido: boolean;
  tempoTotal: number;
  exerciciosExecutados: ExecutedExercise[];
  notasGerais: string;
  rpe?: number; // 1 a 5 (Emoji rating)
  feedbackAluno?: string; // Textual notes
}

export interface ExecutedExercise {
  exerciseId: string;
  series: ExecutedSet[];
  observacoes: string;
}

export interface ExecutedSet {
  numeroSerie: number;
  repeticoes: number;
  carga: number;
  concluido: boolean;
}

export interface MotivationalQuote {
  quoteId: string;
  texto: string;
  ativo: boolean;
  ordem: number;
}

export interface CommunityPost {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
  mentions: string[];
  likes: string[];
  likeCount: number;
  createdAt: any;
}

export interface PostComment {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: any;
}
