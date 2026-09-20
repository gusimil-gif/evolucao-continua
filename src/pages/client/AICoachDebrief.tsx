import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  TrendingUp, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Flame, 
  Dumbbell, 
  Activity, 
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  parseDebriefWithAI, 
  saveDebriefAndSyncLoads, 
  type DebriefAnalysisResult 
} from '../../services/aiCoachDebriefService';
import type { WorkoutPlan, WorkoutDay, CoachDebrief } from '../../types';

export const AICoachDebrief: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [transcription, setTranscription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DebriefAnalysisResult | null>(null);
  const [savedDebriefId, setSavedDebriefId] = useState<string | null>(null);

  // Contexto do Treino Atual do Aluno
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [currentDay, setCurrentDay] = useState<WorkoutDay | null>(null);
  const [scheduledExercises, setScheduledExercises] = useState<Array<{ exerciseId: string; nome: string }>>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [pastDebriefs, setPastDebriefs] = useState<CoachDebrief[]>([]);

  const recognitionRef = useRef<any>(null);

  // 1. Carregar contexto de treino e histórico
  useEffect(() => {
    const fetchContext = async () => {
      if (!userData?.uid) return;
      try {
        // Buscar plano ativo
        const qPlan = query(
          collection(db, 'workoutPlans'),
          where('clientId', '==', userData.uid),
          where('ativo', '==', true),
          limit(1)
        );
        const planSnap = await getDocs(qPlan);
        if (!planSnap.empty) {
          const planData = { ...planSnap.docs[0].data(), planId: planSnap.docs[0].id } as WorkoutPlan;
          setActivePlan(planData);

          // Buscar dias do plano
          const qDays = query(collection(db, 'workoutDays'), where('planId', '==', planData.planId));
          const daySnap = await getDocs(qDays);
          const days = daySnap.docs.map(d => ({ ...d.data(), dayId: d.id } as WorkoutDay));
          
          if (days.length > 0) {
            // Seleciona o primeiro treino ou o correspondente ao dia
            const todayDay = days[0];
            setCurrentDay(todayDay);

            const exList: Array<{ exerciseId: string; nome: string }> = [];
            todayDay.exercicios?.forEach(ex => {
              exList.push({ exerciseId: ex.exerciseId, nome: ex.nome || 'Exercício' });
            });
            setScheduledExercises(exList);
          }
        }

        // Buscar logs recentes para comparação de cargas
        const qLogs = query(
          collection(db, 'workoutLogs'),
          where('clientId', '==', userData.uid),
          orderBy('dataExecucao', 'desc'),
          limit(10)
        );
        const logsSnap = await getDocs(qLogs);
        const logsData = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecentLogs(logsData);

        // Buscar debriefs anteriores do Coach IA
        const qDebriefs = query(
          collection(db, 'coachDebriefs'),
          where('clientId', '==', userData.uid),
          orderBy('data', 'desc'),
          limit(3)
        );
        const debriefSnap = await getDocs(qDebriefs);
        const debriefs = debriefSnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachDebrief));
        setPastDebriefs(debriefs);

      } catch (err) {
        console.error("Erro ao carregar contexto para o Coach IA:", err);
      }
    };

    fetchContext();
  }, [userData]);

  // 2. Configuração de Reconhecimento de Voz (Web Speech API)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setTranscription(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${currentTranscript.trim()}` : currentTranscript.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Erro no reconhecimento de voz:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Permissão de microfone bloqueada pelo navegador.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast("Reconhecimento por voz não suportado neste navegador. Digite seu relato no campo de texto!", {
        icon: 'ℹ️'
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast.success("Áudio pausado!");
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.success("Gravando... Fale livremente sobre seu treino!");
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 3. Atalhos rápidos de relato
  const handleAddPrompt = (promptText: string) => {
    setTranscription(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}. ${promptText}` : promptText;
    });
  };

  // 4. Analisar e Sincronizar com o Coach IA
  const handleAnalyzeAndSync = async () => {
    if (!transcription.trim()) {
      toast.error("Por favor, conte como foi o seu treino ou use os atalhos rápidos!");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setIsAnalyzing(true);
    try {
      // Executa análise inteligente
      const result = await parseDebriefWithAI({
        transcription,
        studentName: userData?.nome,
        clientId: userData?.uid || '',
        trainerId: userData?.trainerId,
        dayId: currentDay?.dayId,
        workoutName: currentDay?.nomeTreino,
        scheduledExercises,
        previousLogs: recentLogs
      });

      setAnalysisResult(result);

      // Salva no Firestore e sincroniza com os gráficos de evolução
      if (userData?.uid) {
        const { debriefId } = await saveDebriefAndSyncLoads({
          clientId: userData.uid,
          clientName: userData.nome,
          trainerId: userData.trainerId,
          dayId: currentDay?.dayId,
          planId: activePlan?.planId,
          workoutName: currentDay?.nomeTreino,
          transcription,
          analysis: result
        });
        setSavedDebriefId(debriefId);
        toast.success("✅ Relato analisado e cargas sincronizadas com sucesso!", { duration: 4000 });
      }

    } catch (err) {
      console.error("Erro na análise:", err);
      toast.error("Ocorreu um erro ao processar. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5. Reiniciar para novo relato
  const handleReset = () => {
    setTranscription('');
    setAnalysisResult(null);
    setSavedDebriefId(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* ============================================================ */}
      {/* HEADER HERO                                                  */}
      {/* ============================================================ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A1A] via-[#141414] to-[#0D0D0D] border border-[#333333] p-6 shadow-xl">
        <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-[#D4A947]/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#D4A947]/10 border border-[#D4A947]/30 text-[#D4A947] text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} className="animate-pulse" />
              Coach IA • Pós-Treino Biomecânico
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F0EDE6] tracking-tight">
              Como foi seu treino hoje, {userData?.nome?.split(' ')[0]}?
            </h1>
            <p className="text-sm text-[#8A8A7A]">
              Fale ou digite naturalmente. A IA detecta suas <strong className="text-[#F0EDE6]">novas cargas</strong>, atualiza seus gráficos de evolução automaticamente e monitora <strong className="text-[#F0EDE6]">dores ou lesões articulares</strong>.
            </p>
          </div>

          {currentDay && (
            <div className="shrink-0 bg-[#252525] border border-[#333333] px-4 py-2.5 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#D4A947]/20 flex items-center justify-center text-[#D4A947]">
                <Dumbbell size={20} />
              </div>
              <div>
                <p className="text-[11px] text-[#8A8A7A] uppercase font-bold tracking-wider">Treino Selecionado</p>
                <p className="text-sm font-semibold text-[#F0EDE6] truncate max-w-[180px]">{currentDay.nomeTreino}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SEÇÃO PRINCIPAL: INPUT DE VOZ / TEXTO & ATALHOS               */}
      {/* ============================================================ */}
      {!analysisResult ? (
        <Card className="p-6 space-y-5 bg-[#1A1A1A] border-[#333333]">
          
          {/* Barra de Ações Rápidas (Chips) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={14} className="text-[#D4A947]" />
                Atalhos Rápidos de 1 Toque:
              </label>
              <span className="text-[11px] text-[#8A8A7A]">Toque para adicionar ao relato</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddPrompt('Subi carga no Supino Reto para 40kg cada lado e fiz 8 repetições')}
                className="text-xs bg-[#252525] hover:bg-[#D4A947]/20 text-[#F0EDE6] hover:text-[#D4A947] border border-[#333333] hover:border-[#D4A947]/50 px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 active:scale-95"
              >
                <span>🔥</span> Subi carga no Supino (40kg cada lado)
              </button>
              <button
                type="button"
                onClick={() => handleAddPrompt('Senti uma pontada no ombro direito na descida do supino inclinado')}
                className="text-xs bg-[#252525] hover:bg-amber-500/20 text-[#F0EDE6] hover:text-amber-400 border border-[#333333] hover:border-amber-500/50 px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 active:scale-95"
              >
                <span>⚠️</span> Pontada no Ombro no Inclinado
              </button>
              <button
                type="button"
                onClick={() => handleAddPrompt('Treino foi muito pesado, RPE 9.0 com falha concêntrica na última série')}
                className="text-xs bg-[#252525] hover:bg-[#D4A947]/20 text-[#F0EDE6] hover:text-[#D4A947] border border-[#333333] hover:border-[#D4A947]/50 px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 active:scale-95"
              >
                <span>⚡</span> RPE 9.0 (Muito Intenso)
              </button>
              <button
                type="button"
                onClick={() => handleAddPrompt('Subi no Leg Press para 240kg e fiz 10 reps limpas sem dor no joelho')}
                className="text-xs bg-[#252525] hover:bg-[#D4A947]/20 text-[#F0EDE6] hover:text-[#D4A947] border border-[#333333] hover:border-[#D4A947]/50 px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 active:scale-95"
              >
                <span>🦵</span> Subi Leg Press (240kg)
              </button>
              <button
                type="button"
                onClick={() => handleAddPrompt('Senti um estalo no joelho esquerdo ao descer no agachamento')}
                className="text-xs bg-[#252525] hover:bg-red-500/20 text-[#F0EDE6] hover:text-red-400 border border-[#333333] hover:border-red-500/50 px-3 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 active:scale-95"
              >
                <span>🚨</span> Estalo no Joelho no Agachamento
              </button>
            </div>
          </div>

          {/* Área de Texto / Transcrição de Voz */}
          <div className="relative">
            <textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="Fale ou digite livremente: 'Treino de pernas foi excelente! Subi no agachamento pra 90kg total e fiz 8 reps. No leg press fiz com 200kg. Senti um leve incômodo na lombar na última série da remada curvada. RPE 8.5...'"
              rows={5}
              className="w-full bg-[#0D0D0D] border border-[#333333] rounded-xl p-4 text-[#F0EDE6] placeholder-[#8A8A7A] focus:outline-none focus:border-[#D4A947] focus:ring-1 focus:ring-[#D4A947] transition-all resize-none text-sm leading-relaxed"
            />

            {isListening && (
              <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-xs font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Ouvindo seu áudio...
              </div>
            )}
          </div>

          {/* Ações de Envio e Microfone */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#333333]">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Botão de Gravação de Voz */}
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 w-full sm:w-auto active:scale-95 shadow-md ${
                  isListening
                    ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse'
                    : 'bg-[#252525] hover:bg-[#D4A947]/20 text-[#F0EDE6] border border-[#333333] hover:border-[#D4A947]'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff size={18} />
                    <span>Pausar Gravação</span>
                  </>
                ) : (
                  <>
                    <Mic size={18} className="text-[#D4A947]" />
                    <span>Falar por Voz</span>
                  </>
                )}
              </button>

              {transcription && (
                <button
                  type="button"
                  onClick={() => setTranscription('')}
                  className="text-xs text-[#8A8A7A] hover:text-red-400 underline transition-colors"
                >
                  Limpar texto
                </button>
              )}
            </div>

            {/* Botão de Processamento com IA */}
            <Button
              onClick={handleAnalyzeAndSync}
              disabled={isAnalyzing || !transcription.trim()}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#D4A947] hover:bg-[#C9A03C] text-[#0D0D0D] font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,169,71,0.3)] transition-all active:scale-95 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#0D0D0D] border-t-transparent rounded-full animate-spin" />
                  <span>Analisando com Coach IA...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Analisar e Sincronizar Cargas</span>
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (

        /* ============================================================ */
        /* RESULTADO DA ANÁLISE: CARDS DE INTELIGÊNCIA & SINCRONIZAÇÃO   */
        /* ============================================================ */
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
          
          {/* 1. Card de Sucesso / Prontidão */}
          <div className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#D4A947]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#D4A947]/20 border border-[#D4A947]/40 flex items-center justify-center text-[#D4A947] shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F0EDE6] flex items-center gap-2">
                  Check-in Processado e Cargas Sincronizadas!
                </h3>
                <p className="text-xs text-[#8A8A7A]">
                  As novas marcas foram salvas e já refletem no seu gráfico de sobrecarga progressiva.
                  {savedDebriefId && <span className="ml-2 font-mono text-[10px] text-[#D4A947] bg-[#252525] px-1.5 py-0.5 rounded border border-[#333333]">Protocolo: #{savedDebriefId.slice(-6).toUpperCase()}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-[#333333]">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-[#8A8A7A] tracking-wider">Índice de Prontidão</p>
                <p className="text-xl font-extrabold text-[#D4A947]">
                  {analysisResult.prontidaoScore} <span className="text-xs font-normal text-[#8A8A7A]">/ 100</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-[#8A8A7A] tracking-wider">RPE Detectado</p>
                <p className="text-xl font-extrabold text-[#F0EDE6]">
                  {analysisResult.rpe} <span className="text-xs font-normal text-[#8A8A7A]">/ 10</span>
                </p>
              </div>
            </div>
          </div>

          {/* 2. Cargas Extraídas e Atualizadas Automaticamente */}
          <Card className="p-6 bg-[#1A1A1A] border-[#333333] space-y-4">
            <div className="flex items-center justify-between border-b border-[#333333] pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-[#D4A947]" />
                <h3 className="font-bold text-[#F0EDE6]">
                  Progressão de Cargas Identificadas ({analysisResult.cargasExtraidas.length})
                </h3>
              </div>
              <span className="text-xs text-[#D4A947] font-semibold bg-[#D4A947]/10 px-2.5 py-1 rounded-full border border-[#D4A947]/20">
                ⚡ Preenchimento Automático
              </span>
            </div>

            {analysisResult.cargasExtraidas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysisResult.cargasExtraidas.map((carga, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl bg-[#252525] border border-[#333333] flex items-center justify-between hover:border-[#D4A947]/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-[#F0EDE6] text-sm">{carga.nomeExercicio}</p>
                      <p className="text-xs text-[#8A8A7A]">
                        {carga.repeticoes ? `${carga.repeticoes} repetições` : 'Série de trabalho'}
                        {carga.observacao && ` • ${carga.observacao}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-black text-[#D4A947]">{carga.carga} kg</p>
                      {carga.delta !== undefined && carga.delta > 0 && (
                        <span className="inline-block text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          +{carga.delta} kg 📈
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#252525] text-[#8A8A7A] text-sm text-center">
                Nenhuma menção numérica explícita de peso identificada neste relato. Mas não se preocupe: seu treino foi registrado com sucesso!
              </div>
            )}
          </Card>

          {/* 3. Alertas Articulares e Biomecânica Preventiva (se houver) */}
          {analysisResult.alertasDor.length > 0 && (
            <Card className="p-6 bg-[#1A1A1A] border-amber-500/50 space-y-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <div className="flex items-center gap-2 text-amber-400 border-b border-amber-500/20 pb-3">
                <ShieldAlert size={22} className="animate-pulse" />
                <h3 className="font-bold text-base">Alerta Articular & Ajustes Biomecânicos Recomendados</h3>
              </div>

              <div className="space-y-3">
                {analysisResult.alertasDor.map((alerta, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#252525] border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#F0EDE6] uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Região: {alerta.articulacao}
                      </span>
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                        alerta.gravidade === 'severa' 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                          : alerta.gravidade === 'moderada'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                      }`}>
                        Gravidade: {alerta.gravidade}
                      </span>
                    </div>

                    <p className="text-xs text-[#8A8A7A] italic">"{alerta.descricao}"</p>

                    <div className="pt-2 border-t border-[#333333] text-xs text-[#F0EDE6] leading-relaxed">
                      <strong className="text-[#D4A947]">Orientação Biomecânica da IA:</strong> {alerta.orientacaoBiomecanica}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 4. Feedback Completo do Coach IA */}
          <Card className="p-6 bg-[#1A1A1A] border-[#333333] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#333333] pb-3">
              <Sparkles size={20} className="text-[#D4A947]" />
              <h3 className="font-bold text-[#F0EDE6]">Análise Clínica & Fisiológica do Treinador IA</h3>
            </div>

            <div className="p-4 rounded-xl bg-[#252525] text-sm text-[#F0EDE6] whitespace-pre-line leading-relaxed border-l-4 border-[#D4A947]">
              {analysisResult.feedbackCoachIA}
            </div>

            {/* Perguntas Estratégicas para o Aluno Refletir */}
            {analysisResult.perguntasEstrategicas.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-[#D4A947]" />
                  Perguntas Estratégicas do Coach para Maximizar sua Recuperação:
                </p>
                <div className="space-y-2">
                  {analysisResult.perguntasEstrategicas.map((perg, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#0D0D0D] border border-[#333333] text-xs text-[#F0EDE6] flex items-center gap-2">
                      <span className="text-[#D4A947] font-bold">0{idx + 1}.</span>
                      <span>{perg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 5. Ações Finais: Ver Gráficos ou Novo Relato */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#252525] hover:bg-[#333333] text-[#F0EDE6] text-sm font-semibold flex items-center justify-center gap-2 transition-all border border-[#333333]"
            >
              <RefreshCw size={16} />
              <span>Fazer Novo Relato</span>
            </button>

            <Button
              onClick={() => navigate('/client/progress')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#D4A947] hover:bg-[#C9A03C] text-[#0D0D0D] font-extrabold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,169,71,0.3)] transition-all active:scale-95"
            >
              <span>Ver Gráficos de Evolução</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* HISTÓRICO DE CHECK-INS RECENTES DO COACH IA                   */}
      {/* ============================================================ */}
      {pastDebriefs.length > 0 && !analysisResult && (
        <div className="space-y-3 pt-4">
          <h2 className="text-base font-bold text-[#F0EDE6] flex items-center gap-2 px-1">
            <Activity size={18} className="text-[#D4A947]" />
            Seus Últimos Check-ins com o Coach IA
          </h2>

          <div className="space-y-2.5">
            {pastDebriefs.map((deb) => (
              <Card key={deb.id} className="p-4 bg-[#1A1A1A] border-[#333333] hover:border-[#D4A947]/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#D4A947]">{deb.nomeTreino || 'Check-in de Treino'}</span>
                  <span className="text-[11px] text-[#8A8A7A]">
                    {deb.data?.toDate ? deb.data.toDate().toLocaleDateString('pt-BR') : new Date(deb.data).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <p className="text-xs text-[#8A8A7A] italic line-clamp-2 mb-2">
                  "{deb.transcricao}"
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#333333]/50">
                  {deb.cargasExtraidas?.map((c, i) => (
                    <span key={i} className="text-[10px] bg-[#252525] border border-[#333333] text-[#F0EDE6] px-2 py-0.5 rounded">
                      {c.nomeExercicio}: <strong className="text-[#D4A947]">{c.carga}kg</strong>
                    </span>
                  ))}

                  {deb.alertasDor && deb.alertasDor.length > 0 && (
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                      <AlertTriangle size={10} /> {deb.alertasDor.length} Alerta(s) Articular(es)
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default AICoachDebrief;
