import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, query, where, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { ArrowLeft, Award, Video, Play, Pause, ChevronRight, CheckCircle2, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WorkoutDay, ExerciseDetails, Exercise, ExecutedSet, WorkoutLog } from '../../types';

export const ActiveWorkout: React.FC = () => {
  const { planId, dayId } = useParams();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [workoutDay, setWorkoutDay] = useState<WorkoutDay | null>(null);
  const [exercisesMeta, setExercisesMeta] = useState<Record<string, Exercise>>({});
  
  // App Modes: 'overview' (Hub) | 'execution' (Spoke)
  const [viewMode, setViewMode] = useState<'overview' | 'execution'>('overview');
  const [activeExIndex, setActiveExIndex] = useState<number | null>(null);
  
  // Global Logs State (mapped by Exercise Index in the Day)
  const [completedLogs, setCompletedLogs] = useState<Record<number, ExecutedSet[]>>({});
  const [globalStartTime] = useState<number>(Date.now());
  const [previousLoads, setPreviousLoads] = useState<Record<string, number>>({});

  // Finish Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [rpe, setRpe] = useState<number>(3);
  const [feedback, setFeedback] = useState('');

  // Execution Timer State
  const [exTime, setExTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [currentSets, setCurrentSets] = useState<ExecutedSet[]>([]);

  useEffect(() => {
    const fetchWorkout = async () => {
      if (!planId || !dayId || dayId === 'undefined' || planId === 'undefined') {
        setLoading(false);
        return;
      }
      
      try {
        const docRef = doc(db, 'workoutDays', dayId);
        const dSnap = await getDoc(docRef);
        
        if (dSnap.exists()) {
          const d = { ...dSnap.data(), dayId: dSnap.id } as WorkoutDay;
          setWorkoutDay(d);
          
          // Buscar Metadados dos Exercícios
          const meta: Record<string, Exercise> = {};
          for (const ex of d.exercicios) {
            if (!meta[ex.exerciseId]) {
              const exQ = query(collection(db, 'exercises'), where('exerciseId', '==', ex.exerciseId));
              const exSnap = await getDocs(exQ);
              if (!exSnap.empty) {
                meta[ex.exerciseId] = exSnap.docs[0].data() as Exercise;
              }
            }
          }
          setExercisesMeta(meta);

          // Buscar Cargas Anteriores (Progressive Overload)
          if (userData?.uid) {
             const prevQ = query(collection(db, 'workoutLogs'), where('clientId', '==', userData.uid));
             const prevSnap = await getDocs(prevQ); // Simplificado sem orderBy para evitar necessidade de Index
             
             const loads: Record<string, number> = {};
             // Ordenar na memória para garantir decrescente
             const oldLogs = prevSnap.docs
                .map(doc => doc.data() as WorkoutLog)
                .filter(l => l.concluido)
                .sort((a, b) => b.dataExecucao.toMillis() - a.dataExecucao.toMillis());

             // Pega até os últimos 10 treinos
             oldLogs.slice(0, 10).forEach(log => {
                log.exerciciosExecutados.forEach(execEx => {
                   if (!loads[execEx.exerciseId]) {
                      // Pegar maior carga usada naquele dia de treino
                      const maxCarga = Math.max(...execEx.series.map(s => Number(s.carga) || 0));
                      if (maxCarga > 0) {
                         loads[execEx.exerciseId] = maxCarga;
                      }
                   }
                });
             });
             setPreviousLoads(loads);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar o treino:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkout();
  }, [planId, dayId]);

  // Lógica do Cronômetro do Exercício
  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setExTime((prev) => prev + 1);
      }, 1000);
    } else if (!isTimerRunning && exTime !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, exTime]);

  const padTime = (n: number) => n.toString().padStart(2, '0');
  const formatTime = (secs: number) => `${padTime(Math.floor(secs / 60))}:${padTime(secs % 60)}`;

  // Inicializar Séries Mapeadas
  const initSets = (exDetail: ExerciseDetails) => {
    return Array.from({ length: exDetail.series }).map((_, i) => ({
      numeroSerie: i + 1,
      repeticoes: parseInt(exDetail.repeticoes.split('-')[0]) || 0,
      carga: 0,
      concluido: false
    }));
  };

  // ==========================================
  // AÇÕES: IR PARA EXECUÇÃO
  // ==========================================
  const handleOpenExercise = (index: number) => {
    if (!workoutDay) return;
    setActiveExIndex(index);
    
    // Restaurar ou Iniciar Checklists
    if (completedLogs[index]) {
      setCurrentSets([...completedLogs[index]]);
    } else {
      setCurrentSets(initSets(workoutDay.exercicios[index]));
    }

    setExTime(0);
    setIsTimerRunning(false);
    setViewMode('execution');
    window.scrollTo(0, 0);
  };

  // ==========================================
  // AÇÕES: DENTRO DA EXECUÇÃO
  // ==========================================
  const handleUpdateSet = (index: number, field: keyof ExecutedSet, value: any) => {
    const newSets = [...currentSets];
    newSets[index] = { ...newSets[index], [field]: value };
    setCurrentSets(newSets);

    // Dica de usabilidade: Iniciar timer automaticamente caso faça check e ele estivesse parado?
    // Somente se for algo relevante. Para agora, manteremos manual.
  };

  const handleSaveAndBack = () => {
    if (activeExIndex === null) return;
    
    // Salvar o checkpoint
    setCompletedLogs(prev => ({
      ...prev,
      [activeExIndex]: currentSets
    }));
    
    // Voltar para Hub
    setIsTimerRunning(false);
    setViewMode('overview');
    setActiveExIndex(null);
  };

  // ==========================================
  // AÇÕES: FINALIZAR TREINO COMPLETO
  // ==========================================
  const handleFinishWorkout = async () => {
    if (!workoutDay) return;
    
    // Compilar Logs
    const aggregatedLogs: any[] = [];
    Object.keys(completedLogs).forEach(key => {
       const idx = Number(key);
       const sets = completedLogs[idx];
       
       // Sair se não teve nenhum check feito no exercício
       const teveProgresso = sets.some(s => s.concluido);
       if (!teveProgresso) return;

       aggregatedLogs.push({
         exerciseId: workoutDay.exercicios[idx].exerciseId,
         series: sets,
         observacoes: ''
       });
    });

    if (aggregatedLogs.length === 0) {
       toast.error("Você não marcou nenhuma série finalizada!");
       return;
    }

    setShowFinishModal(true);
  };

  const submitFinalWorkout = async () => {
    if (!workoutDay) return;
    
    // Compilar Logs de novo para submissão
    const aggregatedLogs: any[] = [];
    Object.keys(completedLogs).forEach(key => {
       const idx = Number(key);
       const sets = completedLogs[idx];
       if (!sets.some(s => s.concluido)) return;
       aggregatedLogs.push({
         exerciseId: workoutDay.exercicios[idx].exerciseId,
         series: sets,
         observacoes: ''
       });
    });

    const totalMinutes = Math.floor((Date.now() - globalStartTime) / 60000);

    try {
      setShowFinishModal(false);
      setLoading(true);
      const payload = {
        clientId: userData?.uid,
        dayId: workoutDay.dayId || 'unknown',
        planId: workoutDay.planId,
        dataExecucao: new Date(),
        concluido: true,
        tempoTotal: totalMinutes,
        exerciciosExecutados: aggregatedLogs,
        notasGerais: '',
        rpe: rpe,
        feedbackAluno: feedback
      };
      const logRef = await addDoc(collection(db, 'workoutLogs'), payload);
      navigate(`/client/completion/${logRef.id}`);
    } catch (error) {
       console.error(error);
       toast.error("Erro ao salvar o log de treino.");
       setLoading(false);
    }
  };


  // ==========================================
  // RENDER: LOADING STATE
  // ==========================================
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center p-12 text-[#8A8A7A] gap-4 min-h-[50vh] animate-in fade-in">
           <div className="w-12 h-12 border-4 border-[#D4A947]/20 border-t-[#D4A947] rounded-full animate-spin"></div>
           <p className="font-semibold tracking-wider">Acordando os Músculos...</p>
        </div>
     );
  }

  if (!workoutDay) {
     return <div className="p-6 text-[#8A8A7A] text-center">Nenhum treino encontrado para esta seleção.</div>;
  }

  // ==========================================
  // RENDER: OVERVIEW (HUB)
  // ==========================================
  if (viewMode === 'overview') {
    return (
      <div className="max-w-3xl mx-auto min-h-screen bg-[#0D0D0D] flex flex-col pb-safe">
        
        {/* MODAL DE FINALIZAR TREINO */}
        {showFinishModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <Card className="w-full max-w-sm bg-[#1A1A1A] border-[#333333] p-6 space-y-6">
                 <div className="text-center">
                    <h2 className="text-2xl font-black text-[#F0EDE6] mb-2">Treino Concluído!</h2>
                    <p className="text-[#8A8A7A] text-sm">Como foi a percepção de esforço de hoje?</p>
                 </div>

                 <div className="flex justify-between items-center px-2">
                    {[
                      { val: 1, emj: '🥱', label: 'Leve' },
                      { val: 2, emj: '🙂', label: 'De boa' },
                      { val: 3, emj: '😅', label: 'Médio' },
                      { val: 4, emj: '🥵', label: 'Pesado' },
                      { val: 5, emj: '💀', label: '110%' }
                    ].map(item => (
                       <button
                         key={item.val}
                         onClick={() => setRpe(item.val)}
                         className={`flex flex-col items-center gap-2 transition-all ${rpe === item.val ? 'scale-125 saturate-150 drop-shadow-[0_0_10px_rgba(212,169,71,0.5)]' : 'opacity-50 hover:opacity-100'}`}
                       >
                         <span className="text-3xl">{item.emj}</span>
                         <span className={`text-[10px] font-bold ${rpe === item.val ? 'text-[#D4A947]' : 'text-[#8A8A7A]'}`}>{item.label}</span>
                       </button>
                    ))}
                 </div>

                 <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider">Anotações para o Treinador</label>
                    <textarea 
                      className="w-full h-24 bg-[#0D0D0D] border border-[#333333] rounded-lg p-3 text-sm text-[#F0EDE6] focus:border-[#D4A947] focus:ring-1 focus:ring-[#D4A947] outline-none resize-none transition-all"
                      placeholder="Sentiu alguma dor? Alguma máquina quebrada? Como foi o rendimento?"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    ></textarea>
                 </div>

                 <div className="flex gap-3 pt-2">
                    <Button onClick={() => setShowFinishModal(false)} variant="secondary" className="flex-1">Voltar</Button>
                    <Button onClick={submitFinalWorkout} className="flex-1 bg-[#D4A947] text-[#0D0D0D] hover:bg-[#C9A03C]">
                       Salvar e Finalizar
                    </Button>
                 </div>
              </Card>
           </div>
        )}

        {/* Cabecalho Hub */}
        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#0D0D0D] border-b border-[#333333] p-6 pt-10 sticky top-0 z-10 shadow-xl">
          <h1 className="text-3xl font-black text-[#F0EDE6]">{workoutDay.nomeTreino}</h1>
          <p className="text-[#8A8A7A] font-medium tracking-wide text-sm uppercase mt-1">{workoutDay.diaSemana} • {workoutDay.exercicios.length} Lifts</p>
        </div>

        {/* Lista de Exercicios (Checklist) */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
           {workoutDay.exercicios.map((exDetail, idx) => {
              const meta = exercisesMeta[exDetail.exerciseId];
              const logSets = completedLogs[idx];
              const isFinished = logSets ? logSets.every(s => s.concluido) : false;
              const partial = logSets ? logSets.some(s => s.concluido) : false;

              return (
                 <div 
                   key={idx} 
                   onClick={() => handleOpenExercise(idx)}
                   className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group hover:-translate-y-0.5 active:scale-95 ${
                     isFinished 
                     ? 'bg-[#D4A947]/5 border-[#D4A947]/40' 
                     : partial 
                       ? 'bg-[#252525] border-[#D4A947]/20 mt-2' 
                       : 'bg-[#1A1A1A] border-[#333333] hover:border-[#D4A947]/50'
                   }`}
                 >
                    <div className="flex items-center gap-4 flex-1">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-black ${
                         isFinished ? 'bg-[#D4A947] text-[#0D0D0D] border-[#D4A947] shadow-[0_0_15px_rgba(212,169,71,0.4)]' : 'bg-[#0D0D0D] border-[#333333] text-[#8A8A7A]'
                       }`}>
                          {isFinished ? <CheckCircle2 size={24} /> : (idx + 1)}
                       </div>
                       <div>
                          <h3 className={`font-bold text-lg ${isFinished ? 'text-[#D4A947]' : 'text-[#F0EDE6]'}`}>{meta?.nome || 'Carregando...'}</h3>
                          <p className="text-xs text-[#8A8A7A]">{exDetail.series} Séries • {exDetail.repeticoes} Reps</p>
                       </div>
                    </div>
                    <ChevronRight className="text-[#8A8A7A] group-hover:text-[#D4A947]" />
                 </div>
              );
           })}
        </div>

        {/* Cta Global */}
        <div className="p-4 bg-gradient-to-t from-[#0D0D0D] pt-6 pb-20 sticky bottom-0 border-t border-[#333333]/50">
           <Button 
             onClick={handleFinishWorkout} 
             className="w-full text-lg h-16 bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] font-black border-none shadow-[0_0_20px_rgba(212,169,71,0.3)] hover:scale-[1.02]"
           >
             <Award className="mr-2" size={26} /> FINALIZAR TREINO
           </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: EXECUTION (SPOKE)
  // ==========================================
  const currentExDetail = workoutDay.exercicios[activeExIndex!];
  const currentMeta = exercisesMeta[currentExDetail.exerciseId];

  return (
    <div className="max-w-3xl mx-auto min-h-screen bg-[#0D0D0D] flex flex-col pb-safe animate-in slide-in-from-right-8 duration-300">
      
      {/* Top Bar Fixa de Execucao (Voltar e Timer Controlavel) */}
      <div className="sticky top-0 bg-[#1A1A1A]/95 backdrop-blur-xl border-b border-[#333333] p-4 pt-8 flex flex-col z-20 shadow-xl">
        <div className="flex items-center justify-between">
          <button 
             onClick={handleSaveAndBack}
             className="flex items-center gap-2 text-[#8A8A7A] hover:text-[#D4A947] px-2 py-2 rounded-lg font-bold"
          >
             <ArrowLeft size={20} /> Voltar
          </button>
          
          {/* Cronometro Interativo */}
          <div className="flex items-center gap-3 bg-[#0D0D0D] border border-[#333333] rounded-full p-1 pl-4 shadow-inner">
             <span className={`font-mono text-xl font-bold w-16 text-center ${isTimerRunning ? 'text-[#D4A947] drop-shadow-[0_0_8px_rgba(212,169,71,0.5)]' : 'text-[#F0EDE6]'}`}>
                {formatTime(exTime)}
             </span>
             <button 
               onClick={() => setIsTimerRunning(!isTimerRunning)} 
               className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                 isTimerRunning 
                 ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                 : 'bg-[#D4A947]/10 border-[#D4A947] text-[#D4A947] shadow-[0_0_10px_rgba(212,169,71,0.2)]'
               }`}
             >
                {isTimerRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
             </button>
             <button 
               onClick={() => {
                 setIsTimerRunning(false);
                 setExTime(0);
               }} 
               className="w-10 h-10 rounded-full bg-[#333333]/50 flex items-center justify-center text-[#8A8A7A] hover:bg-[#333333] transition-all"
             >
                <div className="w-3 h-3 bg-current rounded-sm"></div> {/* Stop Icon */}
             </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Dinâmico (Exercício Selecionado) */}
      <div className="p-4 space-y-6 flex-1">
        <div className="space-y-1">
           <h2 className="text-3xl font-black text-[#F0EDE6]">{currentMeta?.nome}</h2>
           <p className="text-[#D4A947] font-bold text-sm uppercase tracking-wider">{currentMeta?.grupoMuscular}</p>
        </div>

        {/* PROGRESSIVE OVERLOAD / HISTÓRICO */}
        {previousLoads[currentExDetail.exerciseId] && (
           <div className="bg-[#0D0D0D] border border-[#333333] rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4A947]/10 flex items-center justify-center text-[#D4A947]">
                 <Activity size={20} />
              </div>
              <div>
                 <p className="text-xs font-bold text-[#8A8A7A] uppercase tracking-wider">Carga do Último Treino</p>
                 <p className="text-lg font-black text-[#F0EDE6]">{previousLoads[currentExDetail.exerciseId]} <span className="text-sm font-medium text-[#8A8A7A]">kg</span></p>
              </div>
           </div>
        )}

        {currentExDetail?.tecnica && (
           <div className="bg-[#252525] border border-[#333333] p-4 rounded-xl border-l-[4px] border-l-[#D4A947]">
             <h4 className="text-[10px] uppercase font-bold text-[#8A8A7A] mb-1">Técnica Focada</h4>
             <p className="text-sm font-semibold text-[#F0EDE6] leading-tight">{currentExDetail.tecnica}</p>
           </div>
        )}

        {currentMeta?.videoUrl && (
          <a href={currentMeta.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 font-bold hover:bg-red-500/20 hover:border-red-500/50 transition-all shadow-[0_0_15px_rgba(239,68,68,0.05)]">
             <Video size={18} /> Tutorial no YouTube
          </a>
        )}

        <Card className="bg-[#1A1A1A] border-none shadow-none p-0 overflow-hidden mt-6 rounded-2xl">
          <div className="grid grid-cols-4 gap-2 bg-[#0D0D0D] p-4 text-[10px] uppercase font-black tracking-widest text-[#8A8A7A] text-center border-b border-[#333333]/50">
            <div className="text-left w-6">Set</div>
            <div>Carga (kg)</div>
            <div>Reps</div>
            <div className="text-right">Feito</div>
          </div>
          
          <div className="p-3 space-y-3">
            {currentSets.map((set, idx) => (
              <div key={idx} className={`grid grid-cols-4 gap-2 items-center text-center p-3 rounded-xl transition-all ${
                  set.concluido 
                  ? 'bg-gradient-to-r from-[#D4A947]/10 to-transparent border border-[#D4A947]/30' 
                  : 'bg-[#252525] border border-transparent'
               }`}>
                <div className="text-left font-black text-xl text-[#D4A947] w-6 opacity-70">{set.numeroSerie}</div>
                <div>
                  <input 
                    type="number"
                    className="w-16 h-10 bg-[#0D0D0D] border border-[#333333] rounded-lg text-center font-bold text-[#F0EDE6] focus:border-[#D4A947] focus:ring-1 focus:ring-[#D4A947] outline-none transition-all placeholder-[#333333]"
                    placeholder="—"
                    value={set.carga || ''}
                    onChange={(e) => handleUpdateSet(idx, 'carga', Number(e.target.value))}
                    disabled={set.concluido}
                  />
                </div>
                <div>
                  <input 
                    type="number"
                    className="w-16 h-10 bg-[#0D0D0D] border border-[#333333] rounded-lg text-center font-bold text-[#F0EDE6] focus:border-[#D4A947] focus:ring-1 focus:ring-[#D4A947] outline-none transition-all placeholder-[#333333]"
                    placeholder={String(set.repeticoes)}
                    value={set.repeticoes || ''}
                    onChange={(e) => handleUpdateSet(idx, 'repeticoes', Number(e.target.value))}
                    disabled={set.concluido}
                  />
                </div>
                <div className="flex justify-end pr-2">
                  <div className={`transform transition-transform active:scale-75 ${set.concluido ? 'scale-125' : 'scale-110'}`}>
                    <Checkbox 
                      checked={set.concluido} 
                      onChange={(e) => handleUpdateSet(idx, 'concluido', e.target.checked)} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
};

export default ActiveWorkout;
