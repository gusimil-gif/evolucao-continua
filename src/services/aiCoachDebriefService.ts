import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import type { ExtractedExerciseLoad, PainAlert, CoachDebrief } from '../types';
import { firestoreExercises } from '../utils/firestoreExercises';

export interface DebriefAnalysisInput {
  transcription: string;
  studentName?: string;
  clientId: string;
  trainerId?: string;
  dayId?: string;
  workoutName?: string;
  scheduledExercises?: Array<{ exerciseId: string; nome: string }>;
  previousLogs?: any[];
}

export interface DebriefAnalysisResult {
  cargasExtraidas: ExtractedExerciseLoad[];
  alertasDor: PainAlert[];
  rpe: number;
  prontidaoScore: number;
  feedbackCoachIA: string;
  perguntasEstrategicas: string[];
  hasProgression: boolean;
  hasPain: boolean;
}

/**
 * Normaliza strings para busca insensível a acentos e maiúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Mapeamento Biomecânico de Articulações e Orientações de Alta Precisão (2024-2026)
 */
const BIOMECHANICAL_GUIDELINES: Record<string, { advice: string; prevention: string }> = {
  ombro: {
    advice: 'Para preservar o manguito rotador e o espaço subacromial: limite a abdução a 45°-60° no plano escapular, utilize pegada neutra ou semi-neutra com halteres e evite descidas com hiperextensão glenoumeral.',
    prevention: 'Ativação prévia de rotadores externos com elástico (Face Pull / Cuban Press) e mobilidade torácica.'
  },
  lombar: {
    advice: 'Para descompressão dos discos L4-L5/S1: mantenha pressão intra-abdominal ativa (bracing), evite retroversão pélvica na fase funda do agachamento e prefira remadas com apoio no peito.',
    prevention: 'Fortalecimento do core profundo e aquecimento de glúteo máximo para evitar dominância compensatória lombar.'
  },
  joelho: {
    advice: 'Para proteger o tendão patelar e meniscos: controle o valgo dinâmico (não deixe os joelhos colapsarem para dentro). Realize flexão de joelho (mesa flexora) antes de agachar para nutrir a cartilagem com líquido sinovial.',
    prevention: 'Alongamento de quadríceps, liberação miofascial de banda iliotibial e mobilidade de tornozelo (dorsiflexão).'
  },
  cotovelo: {
    advice: 'Para epicondilite ou sobrecarga no tríceps distal: substitua barras retas rígidas por corda no crossover ou pegada neutra em halteres, reduzindo o estresse em valgo no cotovelo.',
    prevention: 'Evite travar em hiperextensão no final do movimento e aqueça antebraços com cargas progressivas.'
  },
  punho: {
    advice: 'Para alívio do túnel do carpo: mantenha o punho sempre em posição neutra e alinhada com o antebraço. Se necessário, use munhequeiras estabilizadoras.',
    prevention: 'Evite apoiar a barra na ponta dos dedos; agarre firme com a base da palma da mão.'
  },
  quadril: {
    advice: 'Para prevenir impacto femoroacetabular: ajuste a largura da base e aponte as pontas dos pés levemente para fora (~20-30°) respeitando a anatomia do seu colo femoral.',
    prevention: 'Mobilidade de quadril em rotação interna/externa antes de agachar ou fazer leg press.'
  },
  outro: {
    advice: 'Monitore a evolução do incômodo nas próximas 24-48 horas. Se houver dor aguda em repouso, reduza a intensidade e consulte seu treinador.',
    prevention: 'Priorize descanso adequado, hidratação e aquecimento articular específico.'
  }
};

/**
 * Parser de Linguagem Natural Especializado em Musculação (PT-BR)
 */
export function analyzeDebriefLocally(input: DebriefAnalysisInput): DebriefAnalysisResult {
  const raw = input.transcription;
  const norm = normalizeText(raw);
  const student = input.studentName || 'Atleta';

  // 1. Extração de Cargas e Exercícios
  const cargasExtraidas: ExtractedExerciseLoad[] = [];

  // Combina exercícios programados do dia + lista mestra de exercícios
  const exerciseCandidates: Array<{ id: string; name: string }> = [];
  
  if (input.scheduledExercises && input.scheduledExercises.length > 0) {
    input.scheduledExercises.forEach(e => exerciseCandidates.push({ id: e.exerciseId, name: e.nome }));
  }

  firestoreExercises.forEach(fe => {
    if (!exerciseCandidates.some(c => c.name.toLowerCase() === fe.nome.toLowerCase())) {
      exerciseCandidates.push({ id: fe.exerciseId, name: fe.nome });
    }
  });

  // Lista de padrões de fala para exercícios comuns
  const patterns: Array<{ regex: RegExp; fallbackName: string; keywords: string[] }> = [
    { regex: /supino\s+inclinado/i, fallbackName: 'Supino Inclinado com Halteres', keywords: ['supino inclinado', 'inclinado halteres', 'inclinado'] },
    { regex: /supino\s+declinado/i, fallbackName: 'Supino Declinado', keywords: ['supino declinado'] },
    { regex: /supino\s+reto|supino\s+com\s+barra|supino\s+no\s+smith|supino\s+livre/i, fallbackName: 'Supino Reto com Barra', keywords: ['supino reto', 'supino com barra'] },
    { regex: /crucifixo/i, fallbackName: 'Crucifixo Reto com Halteres', keywords: ['crucifixo', 'fly', 'peck deck'] },
    { regex: /cross\s*over/i, fallbackName: 'Cross Over', keywords: ['crossover', 'cross over'] },
    { regex: /agachamento/i, fallbackName: 'Agachamento Livre com Barra', keywords: ['agachamento', 'agacho', 'squat'] },
    { regex: /leg\s*press/i, fallbackName: 'Leg Press 45°', keywords: ['leg press', 'leg 45', 'leg horizontal'] },
    { regex: /cadeira\s+extensora|extensora/i, fallbackName: 'Cadeira Extensora', keywords: ['extensora', 'cadeira extensora'] },
    { regex: /mesa\s+flexora|cadeira\s+flexora|flexora/i, fallbackName: 'Mesa Flexora', keywords: ['flexora', 'mesa flexora', 'cadeira flexora'] },
    { regex: /puxada\s+alta|puxada\s+frente|pulley\s+frente/i, fallbackName: 'Puxada Alta pela Frente', keywords: ['puxada', 'pulley frente', 'lat pulldown'] },
    { regex: /remada\s+curvada/i, fallbackName: 'Remada Curvada com Barra', keywords: ['remada curvada', 'remada barra'] },
    { regex: /remada\s+baixa/i, fallbackName: 'Remada Baixa', keywords: ['remada baixa', 'remada sentada'] },
    { regex: /desenvolvimento/i, fallbackName: 'Desenvolvimento com Halteres', keywords: ['desenvolvimento', 'overhead press', 'militar'] },
    { regex: /elevacao\s+lateral/i, fallbackName: 'Elevação Lateral com Halteres', keywords: ['elevacao lateral', 'lateral halteres'] },
    { regex: /triceps\s+corda/i, fallbackName: 'Tríceps Corda no Cross', keywords: ['triceps corda', 'corda cross'] },
    { regex: /triceps\s+testa/i, fallbackName: 'Tríceps Testa com Barra W', keywords: ['triceps testa', 'testa'] },
    { regex: /rosca\s+direta/i, fallbackName: 'Rosca Direta com Barra', keywords: ['rosca direta', 'biceps barra'] },
    { regex: /rosca\s+alternada/i, fallbackName: 'Rosca Alternada com Halteres', keywords: ['rosca alternada', 'biceps halteres'] },
    { regex: /rdl|stiff/i, fallbackName: 'Stiff com Barra', keywords: ['stiff', 'rdl', 'romanian deadlift'] },
    { regex: /panturrilha/i, fallbackName: 'Panturrilha em Pé na Máquina', keywords: ['panturrilha', 'gemeos'] },
    { regex: /elevacao\s+pelvica/i, fallbackName: 'Elevação Pélvica com Barra', keywords: ['elevacao pelvica', 'hip thrust'] }
  ];

  // Identificar exercícios citados
  patterns.forEach(pat => {
    if (pat.regex.test(norm)) {
      // Tentar encontrar o exercício correspondente nos candidatos
      const matched = exerciseCandidates.find(c => pat.keywords.some(kw => normalizeText(c.name).includes(kw))) || {
        id: 'matched_' + Math.random().toString(36).substring(2, 9),
        name: pat.fallbackName
      };

      // Buscar contexto ao redor do exercício no texto
      const exIndex = norm.search(pat.regex);
      const surroundingText = norm.substring(Math.max(0, exIndex - 30), Math.min(norm.length, exIndex + 120));

      // Extrair carga (ex: "40kg", "40 cada lado", "subi para 35", "com 50kg")
      let detectedCarga = 0;
      let observacaoCarga = '';
      
      const cadaLadoMatch = surroundingText.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|quilos)?\s*(?:cada\s+lado|de\s+cada\s+lado|p\/\s*lado)/i);
      const totalKgMatch = surroundingText.match(/(?:com|para|pra|subi\s*pra|aumentei\s*para|botei|peguei|carga\s*de)?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|quilos)/i);
      const simpleNumberMatch = surroundingText.match(/(?:com|para|pra|subi\s*pra|peguei)\s+(\d+(?:[.,]\d+)?)\b/i);

      if (cadaLadoMatch) {
        const pesoLado = parseFloat(cadaLadoMatch[1].replace(',', '.'));
        detectedCarga = pesoLado * 2; // Carga total somada das duas anilhas
        observacaoCarga = `${pesoLado}kg cada lado (total anilhas: ${detectedCarga}kg)`;
      } else if (totalKgMatch) {
        detectedCarga = parseFloat(totalKgMatch[1].replace(',', '.'));
        observacaoCarga = `${detectedCarga}kg total`;
      } else if (simpleNumberMatch) {
        detectedCarga = parseFloat(simpleNumberMatch[1].replace(',', '.'));
        observacaoCarga = `${detectedCarga}kg total`;
      }

      // Extrair repetições se citadas (ex: "8 reps", "10 repeticoes", "fiz 8")
      let reps: number | undefined;
      const repsMatch = surroundingText.match(/(\d+)\s*(?:reps|repeticoes|repeticao|vezes)/i) ||
                        surroundingText.match(/(?:fiz|mandei|bati)\s+(\d+)\b/i);
      if (repsMatch) {
        reps = parseInt(repsMatch[1], 10);
      }

      if (detectedCarga > 0 && !cargasExtraidas.some(c => c.nomeExercicio === matched.name)) {
        // Buscar carga anterior se disponível nos logs
        let previousLoad: number | undefined;
        if (input.previousLogs) {
          for (const l of input.previousLogs) {
            const foundEx = l.exerciciosExecutados?.find((e: any) => e.exerciseId === matched.id);
            if (foundEx && foundEx.series) {
              const maxL = Math.max(...foundEx.series.map((s: any) => s.carga || 0));
              if (maxL > 0) {
                previousLoad = maxL;
                break;
              }
            }
          }
        }

        const delta = previousLoad ? Math.round((detectedCarga - previousLoad) * 10) / 10 : undefined;

        cargasExtraidas.push({
          exerciseId: matched.id,
          nomeExercicio: matched.name,
          carga: detectedCarga,
          cargaAnterior: previousLoad,
          delta: delta,
          repeticoes: reps || 10,
          observacao: observacaoCarga
        });
      }
    }
  });

  // 2. Extração de Alertas Articulares e Dores
  const alertasDor: PainAlert[] = [];
  const painKeywords = ['dor', 'doeu', 'doendo', 'pontada', 'fisgada', 'incomodo', 'estalo', 'estalou', 'beliscao', 'queimacao articular', 'machuquei', 'lesao'];
  const hasPainMention = painKeywords.some(kw => norm.includes(kw));

  if (hasPainMention) {
    const jointPatterns: Array<{ joint: PainAlert['articulacao']; keywords: string[] }> = [
      { joint: 'ombro', keywords: ['ombro', 'manguito', 'clavicula', 'deltoide anterior'] },
      { joint: 'lombar', keywords: ['lombar', 'coluna', 'costas embaixo', 'l4', 'l5'] },
      { joint: 'joelho', keywords: ['joelho', 'patela', 'menisco', 'ligamento'] },
      { joint: 'cotovelo', keywords: ['cotovelo', 'epicondilo', 'antibraco'] },
      { joint: 'punho', keywords: ['punho', 'pulso', 'mao'] },
      { joint: 'quadril', keywords: ['quadril', 'virilha', 'fêmur'] },
      { joint: 'cervical', keywords: ['pescoco', 'cervical', 'trapezio'] }
    ];

    jointPatterns.forEach(jp => {
      if (jp.keywords.some(kw => norm.includes(kw))) {
        // Gravidade
        let gravidade: PainAlert['gravidade'] = 'leve';
        if (norm.includes('forte') || norm.includes('muito') || norm.includes('insuportavel') || norm.includes('aguda') || norm.includes('grave')) {
          gravidade = 'severa';
        } else if (norm.includes('pontada') || norm.includes('fisgada') || norm.includes('moderada') || norm.includes('estalo')) {
          gravidade = 'moderada';
        }

        // Tentar identificar exercício gatilho mais próximo da palavra de dor/articulação
        let gatilho = '';
        let minDistance = 9999;
        const jointIndices = jp.keywords.map(kw => norm.indexOf(kw)).filter(idx => idx !== -1);
        const jointPos = jointIndices.length > 0 ? Math.min(...jointIndices) : 0;

        patterns.forEach(pat => {
          const match = norm.match(pat.regex);
          if (match && match.index !== undefined) {
            const dist = Math.abs(match.index - jointPos);
            if (dist < minDistance) {
              minDistance = dist;
              gatilho = pat.fallbackName;
            }
          }
        });

        const guidelines = BIOMECHANICAL_GUIDELINES[jp.joint] || BIOMECHANICAL_GUIDELINES['outro'];

        alertasDor.push({
          articulacao: jp.joint,
          gravidade: gravidade,
          exercicioGatilho: gatilho || undefined,
          descricao: `Relatou desconforto/dor no(a) ${jp.joint}${gatilho ? ` durante ${gatilho}` : ''}.`,
          orientacaoBiomecanica: guidelines.advice
        });
      }
    });
  }

  // 3. Extração de RPE e Percepção de Esforço
  let rpe = 8.0; // Padrão seguro
  const rpeDirectMatch = norm.match(/rpe\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/i) || norm.match(/nota\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/i);
  if (rpeDirectMatch) {
    const val = parseFloat(rpeDirectMatch[1].replace(',', '.'));
    if (val >= 1 && val <= 10) rpe = val;
  } else if (norm.includes('morrendo') || norm.includes('falha total') || norm.includes('pesadissimo')) {
    rpe = 9.5;
  } else if (norm.includes('pesado') || norm.includes('puxado') || norm.includes('intenso')) {
    rpe = 8.5;
  } else if (norm.includes('tranquilo') || norm.includes('facil') || norm.includes('leve')) {
    rpe = 6.5;
  }

  // 4. Cálculo do Índice de Prontidão & Sobrecarga (0 a 100)
  let prontidaoScore = 88;
  if (alertasDor.length > 0) {
    const maxGravidade = alertasDor.some(a => a.gravidade === 'severa') ? 3 : alertasDor.some(a => a.gravidade === 'moderada') ? 2 : 1;
    prontidaoScore -= maxGravidade * 15;
  }
  if (rpe >= 9.5) prontidaoScore -= 8;
  if (cargasExtraidas.length > 0) prontidaoScore += 6;
  prontidaoScore = Math.max(40, Math.min(98, prontidaoScore));

  // 5. Geração de Feedback Profissional do Coach IA
  const progressoesTexto = cargasExtraidas.length > 0
    ? `Identifiquei com precisão a evolução das suas cargas: ${cargasExtraidas.map(c => `**${c.nomeExercicio}** (${c.carga}kg${c.delta && c.delta > 0 ? ` • +${c.delta}kg` : ''})`).join(', ')}. A sobrecarga progressiva com técnica limpa é a chave da hipertrofia mediada por tensão mecânica!`
    : `Parabéns pelo treino consistente, ${student}! Manter a frequência e a disciplina de registrar o estímulo neuromuscular constrói resultados duradouros.`;

  let orientacaoDorTexto = '';
  if (alertasDor.length > 0) {
    orientacaoDorTexto = `\n\n⚠️ **Atenção Biomecânica Preventiva:**\n` +
      alertasDor.map(a => `• **${a.articulacao.toUpperCase()} (${a.gravidade.toUpperCase()}):** ${a.orientacaoBiomecanica}`).join('\n');
  }

  const feedbackCoachIA = `${progressoesTexto}${orientacaoDorTexto}\n\nSeu personal trainer foi notificado no painel com essas atualizações e já deixei tudo registrado no seu gráfico de evolução!`;

  // 6. Perguntas Estratégicas Personalizadas para engajar o aluno
  const perguntasEstrategicas: string[] = [];
  if (alertasDor.length > 0) {
    perguntasEstrategicas.push(`O desconforto no ${alertasDor[0].articulacao} foi durante a descida (fase excêntrica) ou na subida com carga máxima?`);
    perguntasEstrategicas.push(`A dor cessou após terminar o treino ou continua latejando em repouso?`);
  } else if (cargasExtraidas.length > 0) {
    perguntasEstrategicas.push(`Sentiu que manteve de 1 a 2 repetições na reserva (RIR 1-2) com essa nova carga, ou chegou até a falha concêntrica total?`);
    perguntasEstrategicas.push(`Como está sua hidratação e sono para acelerar a recuperação muscular até o próximo treino?`);
  } else {
    perguntasEstrategicas.push(`Em qual exercício sentiu a melhor contração muscular e 'pump' hoje?`);
    perguntasEstrategicas.push(`Dormiu quantas horas na noite anterior? O descanso é quando o músculo realmente cresce.`);
  }

  return {
    cargasExtraidas,
    alertasDor,
    rpe,
    prontidaoScore,
    feedbackCoachIA,
    perguntasEstrategicas,
    hasProgression: cargasExtraidas.length > 0,
    hasPain: alertasDor.length > 0
  };
}

/**
 * Análise com Gemini 1.5 Flash (caso chave exista) com fallback automático para o motor determinístico
 */
export async function parseDebriefWithAI(input: DebriefAnalysisInput): Promise<DebriefAnalysisResult> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

  // Se não houver chave externa configurada, executa instantaneamente o motor local (<2ms)
  if (!apiKey) {
    return analyzeDebriefLocally(input);
  }

  try {
    const scheduledList = input.scheduledExercises?.map(e => `- ${e.nome} (ID: ${e.exerciseId})`).join('\n') || 'Nenhum exercício explicitado';
    
    const prompt = `Você é um Fisiologista do Exercício e Coach de Musculação de Elite (padrão ACSM / Schoenfeld).
Analise o relato pós-treino do aluno e extraia com precisão cargas progressivas, alertas de dor/lesão e responda em JSON.

ALUNO: ${input.studentName || 'Aluno'}
EXERCÍCIOS PROGRAMADOS NO TREINO:
${scheduledList}

RELATO DO ALUNO:
"${input.transcription}"

INSTRUÇÕES DE EXTRAÇÃO:
1. "cargasExtraidas": Liste os exercícios citados com a nova carga em kg (se citar "X kg cada lado", multiplique por 2 para anilhas totais ou registre claramente). Adicione repeticoes se citadas.
2. "alertasDor": Se citou dor/desconforto/estalo/pontada, identifique a articulação (ombro, lombar, joelho, cotovelo, punho, quadril, cervical), gravidade (leve, moderada, severa) e dê uma orientação biomecânica estrita (ex: plano escapular, ângulo de descida, descompressão).
3. "rpe": Percepção de esforço de 1 a 10.
4. "prontidaoScore": Pontuação de prontidão/recuperação de 0 a 100.
5. "feedbackCoachIA": Mensagem motivadora, técnica e empática em PT-BR para o aluno.
6. "perguntasEstrategicas": 2 perguntas cirúrgicas para aprofundar a recuperação (sono, RIR, dor excêntrica vs concêntrica).

Retorne ESTRITAMENTE um JSON no seguinte formato (sem \`\`\`json):
{
  "cargasExtraidas": [
    { "exerciseId": "string", "nomeExercicio": "string", "carga": 40, "repeticoes": 8, "observacao": "string" }
  ],
  "alertasDor": [
    { "articulacao": "ombro", "gravidade": "moderada", "exercicioGatilho": "string", "descricao": "string", "orientacaoBiomecanica": "string" }
  ],
  "rpe": 8.5,
  "prontidaoScore": 85,
  "feedbackCoachIA": "string",
  "perguntasEstrategicas": ["pergunta 1", "pergunta 2"]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!res.ok) {
      return analyzeDebriefLocally(input);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return analyzeDebriefLocally(input);

    const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      cargasExtraidas: parsed.cargasExtraidas || [],
      alertasDor: parsed.alertasDor || [],
      rpe: parsed.rpe || 8.0,
      prontidaoScore: parsed.prontidaoScore || 85,
      feedbackCoachIA: parsed.feedbackCoachIA || '',
      perguntasEstrategicas: parsed.perguntasEstrategicas || [],
      hasProgression: (parsed.cargasExtraidas?.length || 0) > 0,
      hasPain: (parsed.alertasDor?.length || 0) > 0
    };
  } catch (e) {
    console.warn("Falha na chamada da API Gemini, usando motor de biomecânica determinístico:", e);
    return analyzeDebriefLocally(input);
  }
}

/**
 * Salva o Debrief no Firestore e Sincroniza Automaticamente com os Gráficos de Evolução (workoutLogs)
 */
export async function saveDebriefAndSyncLoads(params: {
  clientId: string;
  clientName: string;
  trainerId?: string;
  dayId?: string;
  planId?: string;
  workoutName?: string;
  transcription: string;
  analysis: DebriefAnalysisResult;
}): Promise<{ debriefId: string; logId: string }> {
  const { clientId, clientName, trainerId, dayId, planId, workoutName, transcription, analysis } = params;

  // 1. Salvar na coleção 'coachDebriefs'
  const debriefPayload: CoachDebrief = {
    clientId,
    clientName,
    trainerId: trainerId || 'piVnSDRpv8SOpmdSzmDbpWCSwFc2',
    dayId: dayId || 'general',
    nomeTreino: workoutName || 'Check-in Pós-Treino',
    data: new Date(),
    transcricao: transcription,
    cargasExtraidas: analysis.cargasExtraidas,
    alertasDor: analysis.alertasDor,
    rpe: analysis.rpe,
    prontidaoScore: analysis.prontidaoScore,
    feedbackCoachIA: analysis.feedbackCoachIA,
    perguntasEstrategicas: analysis.perguntasEstrategicas,
    status: 'novo'
  };

  const debriefRef = await addDoc(collection(db, 'coachDebriefs'), {
    ...debriefPayload,
    criadoEm: serverTimestamp()
  });

  // 2. Sincronizar com 'workoutLogs' para alimentar os gráficos de evolução de cargas imediatamente
  let logId = '';
  try {
    const exerciciosParaLog = analysis.cargasExtraidas.map(c => ({
      exerciseId: c.exerciseId,
      series: [
        {
          numeroSerie: 1,
          carga: c.carga,
          repeticoes: c.repeticoes || 10,
          concluido: true
        }
      ],
      observacoes: c.observacao || 'Atualizado automaticamente pelo Coach IA'
    }));

    if (exerciciosParaLog.length > 0) {
      const workoutLogPayload = {
        clientId,
        dayId: dayId || 'ia_debrief',
        planId: planId || 'plano_ativo',
        dataExecucao: new Date(),
        concluido: true,
        tempoTotal: 60,
        exerciciosExecutados: exerciciosParaLog,
        notasGerais: `Check-in com Coach IA. Score de Prontidão: ${analysis.prontidaoScore}/100.`,
        rpe: Math.round(analysis.rpe / 2), // 1 a 5 escala padrão de logs
        feedbackAluno: transcription,
        origemDebriefId: debriefRef.id
      };

      const logRef = await addDoc(collection(db, 'workoutLogs'), workoutLogPayload);
      logId = logRef.id;

      // Vincular o log criado ao debrief
      await updateDoc(doc(db, 'coachDebriefs', debriefRef.id), {
        syncWorkoutLogId: logId
      });
    }
  } catch (err) {
    console.error("Erro ao sincronizar workoutLogs:", err);
  }

  return {
    debriefId: debriefRef.id,
    logId
  };
}
