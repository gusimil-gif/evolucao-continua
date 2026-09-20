import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PlayCircle, Award, Calendar as CalendarIcon, Target, ChevronRight, Droplet, Utensils, Moon, Flame, Gem, Sparkles, ShieldCheck, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutPlan, WorkoutDay, WorkoutLog } from '../../types';

export const ClientDashboard: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutDay | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutDay[]>([]);
  const [streak, setStreak] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Hábitos
  const [habits, setHabits] = useState({ water: false, diet: false, sleep: false });
  const todayISO = new Date().toISOString().split('T')[0];

  const DIAS_SEMANA = ['Treino A', 'Treino B', 'Treino C', 'Treino D', 'Treino E', 'Treino F', 'Treino G'];

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!userData?.uid) return;
      try {
        let loadedDays: WorkoutDay[] = [];
        const qPlan = query(collection(db, 'workoutPlans'), where('clientId', '==', userData.uid), where('ativo', '==', true));
        const qLogs = query(collection(db, 'workoutLogs'), where('clientId', '==', userData.uid));
        const habitDoc = doc(db, 'dailyHabits', `${userData.uid}_${todayISO}`);

        // Executa consultas independentes em paralelo com Promise.all
        const [pSnap, logsSnap, habitSnap] = await Promise.all([
          getDocs(qPlan),
          getDocs(qLogs),
          getDoc(habitDoc)
        ]);

        if (habitSnap.exists()) {
          setHabits(habitSnap.data() as any);
        }

        if (!pSnap.empty) {
          const plan = pSnap.docs[0].data() as WorkoutPlan;
          setActivePlan(plan);

          // Queries para Workout Days
          const qDays = query(collection(db, 'workoutDays'), where('planId', '==', pSnap.docs[0].id));
          const dSnap = await getDocs(qDays);
          loadedDays = dSnap.docs.map(d => ({ ...d.data(), dayId: d.id } as WorkoutDay));
          
          // Ordenar pela sequência de Treinos (A, B, C...)
          loadedDays.sort((a, b) => DIAS_SEMANA.indexOf(a.diaSemana) - DIAS_SEMANA.indexOf(b.diaSemana));
          setAllWorkouts(loadedDays);
        }

        const logs = logsSnap.docs.map(l => l.data() as WorkoutLog).filter(l => l.concluido === true);
        
        // Calcular Mês
        const currMonth = new Date().getMonth();
        const currYear = new Date().getFullYear();
        let monCount = 0;
        
        const datesArray: Date[] = [];
        logs.forEach(l => {
          if (l.dataExecucao) {
            const dt = l.dataExecucao.toDate();
            datesArray.push(dt);
            if (dt.getMonth() === currMonth && dt.getFullYear() === currYear) monCount++;
          }
        });
        setMonthTotal(monCount);
        
        // Calcular Streak
        datesArray.sort((a,b) => b.getTime() - a.getTime()); // Decrescente
        let currStreak = 0;
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        
        const removeTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const todayT = removeTime(startOfToday);
        
        if (datesArray.length > 0) {
           let lastT = removeTime(datesArray[0]);
           
           // Pode começar com hoje, ou ontem. Se o mais recente for mais antigo que ontem, streak = 0.
           if (lastT === todayT || lastT === todayT - 86400000) {
              currStreak = 1;
              for (let i = 1; i < datesArray.length; i++) {
                 const t = removeTime(datesArray[i]);
                 const diffDays = (lastT - t) / 86400000;
                 if (diffDays === 1) {
                    currStreak++;
                    lastT = t;
                 } else if (diffDays === 0) {
                    // Mesma data de conclusão (fez 2 treinos num dia)
                 } else {
                    break;
                 }
              }
           }
        }
        setStreak(currStreak);
        
        // Calcular o próximo treino da sequência (auto-progressão)
        let nextWorkout: WorkoutDay | null = null;
        if (loadedDays.length > 0) {
          nextWorkout = loadedDays[0]; // Padrão: primeiro treino (Treino A)
          if (logs.length > 0) {
            // Ordenar logs por data de execução decrescente (mais recente primeiro)
            const sortedLogs = [...logs].sort((a, b) => b.dataExecucao.toMillis() - a.dataExecucao.toMillis());
            const lastLog = sortedLogs[0];
            
            const lastDayIndex = loadedDays.findIndex(d => d.dayId === lastLog.dayId);
            if (lastDayIndex !== -1) {
              const nextIndex = (lastDayIndex + 1) % loadedDays.length;
              nextWorkout = loadedDays[nextIndex];
            }
          }
        }
        setTodayWorkout(nextWorkout);
        

      } catch (error) {
        console.error("Erro ao carregar dashboard", error);
      } finally {
        setLoading(false);
      }
    };

    // Forçar destravamento para evitar tela congelada por erro de rede do firebase
    const timeout = setTimeout(() => setLoading(false), 5000);
    fetchDashboard().finally(() => clearTimeout(timeout));
  }, [userData]);

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center p-12 text-[#8A8A7A] gap-4 min-h-[50vh] animate-in fade-in">
           <div className="w-12 h-12 border-4 border-[#D4A947]/20 border-t-[#D4A947] rounded-full animate-spin"></div>
           <p className="font-semibold tracking-wider">Carregando Treino...</p>
        </div>
     );
  }

  const toggleHabit = async (key: 'water' | 'diet' | 'sleep') => {
    if (!userData?.uid) return;
    const newHabits = { ...habits, [key]: !habits[key] };
    setHabits(newHabits);
    try {
      await setDoc(doc(db, 'dailyHabits', `${userData.uid}_${todayISO}`), newHabits, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const hasTrainer = Boolean(
    userData?.trainerId ||
    (activePlan && (activePlan as any).criadoPor !== 'student_ai' && activePlan.trainerId)
  );

  const planStartDate = activePlan?.dataInicio 
    ? (activePlan.dataInicio.toDate ? activePlan.dataInicio.toDate() : new Date(activePlan.dataInicio)) 
    : (activePlan?.dataCriacao ? (activePlan.dataCriacao.toDate ? activePlan.dataCriacao.toDate() : new Date(activePlan.dataCriacao)) : new Date());
  
  const daysActive = activePlan ? Math.max(0, Math.floor((Date.now() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const daysLeft = Math.max(0, 90 - daysActive);
  const currentWeek = Math.min(12, Math.floor(daysActive / 7) + 1);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-[#D4A947]/20 flex items-center justify-center text-2xl font-black text-[#D4A947]">
          {userData?.nome.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE6]">Olá, {userData?.nome}!</h1>
          <p className="text-[#8A8A7A]">Pronto para superar seus limites hoje?</p>
        </div>
      </div>

      {/* Informações da Ficha e Acesso Controlado à Periodização */}
      {hasTrainer ? (
        <div className="bg-[#1A1A1A] border border-[#333333] p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#D4A947]/10 text-[#D4A947] flex items-center justify-center font-bold shrink-0 border border-[#D4A947]/20">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#D4A947] uppercase tracking-wider">Acompanhamento Personal Trainer</span>
                <span className="text-[10px] bg-[#D4A947]/20 text-[#D4A947] px-2 py-0.5 rounded-full font-extrabold uppercase">Ativo</span>
              </div>
              <p className="text-xs text-[#8A8A7A] mt-0.5">
                Ficha prescrita e supervisionada por <strong>Personal Lázaro Timóteo</strong>. Foco em continuidade e sobrecarga progressiva.
              </p>
            </div>
          </div>
        </div>
      ) : !activePlan ? (
        <div 
          onClick={() => navigate('/client/ai-workout')}
          className="bg-gradient-to-r from-[#D4A947]/20 via-[#1A1A1A] to-[#1A1A1A] border border-[#D4A947]/40 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-[#D4A947] hover:shadow-[0_0_20px_rgba(212,169,71,0.15)] transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#D4A947] flex items-center justify-center text-[#0D0D0D] font-black shrink-0 shadow-[0_0_15px_rgba(212,169,71,0.4)] group-hover:scale-105 transition-transform">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#F0EDE6]">Monte seu Primeiro Treino com IA</h3>
                <span className="text-[10px] bg-[#D4A947]/20 text-[#D4A947] px-2 py-0.5 rounded-full font-extrabold uppercase">Início</span>
              </div>
              <p className="text-xs text-[#8A8A7A] mt-0.5">Responda a anamnese biomecânica e a IA prescreve seu treino sob medida.</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold text-[#D4A947] group-hover:translate-x-1 transition-transform self-end sm:self-center">
            <span>Começar</span>
            <ChevronRight size={16} />
          </div>
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#333333] p-4 sm:p-5 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="text-[#D4A947]" size={18} />
              <h3 className="font-bold text-sm text-[#F0EDE6]">Ciclo de Periodização • Semana {currentWeek} de 12</h3>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full w-fit ${daysLeft === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#D4A947]/10 text-[#D4A947] border border-[#D4A947]/30'}`}>
              {daysLeft === 0 ? 'Ciclo Concluído (3 Meses)' : `${daysLeft} dias restantes`}
            </span>
          </div>

          <div className="w-full bg-[#0D0D0D] rounded-full h-2 overflow-hidden border border-[#333333]">
            <div 
              className="bg-gradient-to-r from-[#D4A947] to-[#B8922E] h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, Math.round((daysActive / 90) * 100)))}%` }}
            />
          </div>

          <p className="text-xs text-[#8A8A7A] leading-relaxed">
            A literatura científica comprova que a <strong>sobrecarga progressiva contínua por no mínimo 3 meses (12 semanas)</strong> é indispensável para adaptação neural e hipertrofia consistente. Mudar de treino a cada semana zera a adaptação mecânica.
          </p>

          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#8A8A7A]">
            <span>{daysLeft === 0 ? 'Você já pode renovar sua periodização!' : `Janela recomendada para nova ficha em ${daysLeft} dias.`}</span>
            {daysLeft === 0 ? (
              <Button 
                type="button" 
                size="sm"
                onClick={() => navigate('/client/ai-workout')}
                className="bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] font-bold text-xs"
              >
                <Sparkles size={14} className="mr-1.5" />
                Renovar Periodização IA
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/client/ai-workout')}
                className="text-[#8A8A7A] hover:text-[#D4A947] underline cursor-pointer text-left sm:text-right"
              >
                Avançado: Solicitar novo treino antecipadamente
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Principal: Treino do Dia e Outros Dias */}
        <div className="md:col-span-2 space-y-6">
           <Card className="border-[#D4A947]/30 bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] overflow-hidden group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4A947]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
             <div className="relative z-10 flex justify-between items-start mb-6">
               <div>
                 <h2 className="text-xl font-bold text-[#F0EDE6] flex items-center gap-2">
                   <Target className="text-[#D4A947]" /> Próximo Treino da Sequência
                 </h2>
                 {activePlan ? (
                   <p className="text-[#8A8A7A] mt-1 font-medium">{activePlan.nomePlano}</p>
                 ) : (
                   <p className="text-[#8A8A7A] mt-1">Você não possui um plano ativo.</p>
                 )}
               </div>
             </div>

             {todayWorkout ? (
               <div className="relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-[#0D0D0D]/50 border border-[#333333] p-5 rounded-xl shadow-inner">
                   <h3 className="text-lg font-bold text-[#D4A947] mb-1">{todayWorkout.nomeTreino}</h3>
                   <p className="text-sm text-[#8A8A7A]">{todayWorkout.exercicios.length} exercícios focados.</p>
                 </div>

                 <Button 
                   onClick={() => navigate(`/client/workout/${todayWorkout.planId}/${todayWorkout.dayId}`)} 
                   className="w-full text-lg h-14 shadow-[0_0_15px_rgba(212,169,71,0.3)] hover:shadow-[0_0_25px_rgba(212,169,71,0.5)] transition-all hover:-translate-y-0.5"
                 >
                   <PlayCircle className="mr-2" size={24} /> Começar Agora
                 </Button>
               </div>
             ) : (
               <div className="py-10 text-center text-[#8A8A7A] relative z-10">
                 Nenhum treino específico apontado para Hoje. Aproveite para descansar ou escolha outro treino abaixo!
               </div>
             )}
           </Card>

           {/* Listagem de Outros Treinos da Sequência */}
           {allWorkouts.length > 0 && (
             <div className="space-y-3 animate-in fade-in duration-700">
               <h3 className="text-lg font-bold text-[#F0EDE6] px-1">Lista de Treinos</h3>
               <div className="grid gap-3">
                 {allWorkouts.filter(w => w.dayId !== todayWorkout?.dayId).map((workout) => (
                   <div 
                     key={workout.dayId} 
                     onClick={() => navigate(`/client/workout/${workout.planId}/${workout.dayId}`)}
                     className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333333] flex justify-between items-center cursor-pointer hover:border-[#D4A947]/50 hover:bg-[#252525] transition-all group"
                   >
                     <div>
                       <p className="text-sm font-semibold text-[#D4A947]">{workout.diaSemana}</p>
                       <h4 className="font-medium text-[#F0EDE6]">{workout.nomeTreino}</h4>
                     </div>
                     <ChevronRight className="text-[#8A8A7A] group-hover:text-[#D4A947] transition-colors" />
                   </div>
                 ))}
               </div>
             </div>
           )}
        </div>

        {/* Coluna da Direita (Métricas, Badges e Hábitos) */}
        <div className="space-y-6 flex flex-col">
          
          {/* Estatísticas Numéricas */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col items-center justify-center text-center group hover:-translate-y-1 transition-transform border-[#333333] hover:border-[#D4A947]/30 p-4">
              <div className="w-12 h-12 rounded-full bg-[#0D0D0D] border border-[#333333] flex items-center justify-center mb-2 group-hover:shadow-[0_0_15px_rgba(212,169,71,0.2)] transition-shadow">
                 <Award className="text-[#D4A947] w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-[#F0EDE6]">{streak}</h3>
              <p className="text-[#8A8A7A] font-medium text-[10px] uppercase tracking-widest mt-1">Dias seguidos</p>
            </Card>
            
            <Card className="flex flex-col items-center justify-center text-center group hover:-translate-y-1 transition-transform border-[#333333] hover:border-[#D4A947]/30 p-4">
              <div className="w-12 h-12 rounded-full bg-[#0D0D0D] border border-[#333333] flex items-center justify-center mb-2 group-hover:shadow-[0_0_15px_rgba(212,169,71,0.2)] transition-shadow">
                 <CalendarIcon className="text-[#8A8A7A] group-hover:text-[#D4A947] transition-colors w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-[#F0EDE6]">{monthTotal}</h3>
              <p className="text-[#8A8A7A] font-medium text-[10px] uppercase tracking-widest mt-1">Deste Mês</p>
            </Card>
          </div>

          {/* HÁBITOS CIRCADIANOS (FRENTE 4) */}
          <Card className="border-[#333333] bg-[#1A1A1A]">
             <h3 className="text-sm font-bold text-[#F0EDE6] uppercase tracking-wider mb-4 px-1">Checklist de Hábitos</h3>
             <div className="space-y-3">
                <button 
                  onClick={() => toggleHabit('water')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${habits.water ? 'bg-blue-500/10 border-blue-500/50' : 'bg-[#0D0D0D] border-[#333333] hover:border-blue-500/30'}`}
                >
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${habits.water ? 'bg-blue-500 text-[#0D0D0D]' : 'bg-[#252525] text-[#8A8A7A]'}`}>
                         <Droplet size={16} fill={habits.water ? 'currentColor' : 'none'} />
                      </div>
                      <span className={`font-semibold text-sm ${habits.water ? 'text-blue-400' : 'text-[#F0EDE6]'}`}>3L de Água</span>
                   </div>
                   <div className={`w-5 h-5 rounded-full border-2 ${habits.water ? 'border-blue-500 bg-blue-500' : 'border-[#8A8A7A]'}`}></div>
                </button>

                <button 
                  onClick={() => toggleHabit('diet')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${habits.diet ? 'bg-green-500/10 border-green-500/50' : 'bg-[#0D0D0D] border-[#333333] hover:border-green-500/30'}`}
                >
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${habits.diet ? 'bg-green-500 text-[#0D0D0D]' : 'bg-[#252525] text-[#8A8A7A]'}`}>
                         <Utensils size={16} />
                      </div>
                      <span className={`font-semibold text-sm ${habits.diet ? 'text-green-400' : 'text-[#F0EDE6]'}`}>Dieta Plena</span>
                   </div>
                   <div className={`w-5 h-5 rounded-full border-2 ${habits.diet ? 'border-green-500 bg-green-500' : 'border-[#8A8A7A]'}`}></div>
                </button>

                <button 
                  onClick={() => toggleHabit('sleep')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${habits.sleep ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-[#0D0D0D] border-[#333333] hover:border-indigo-500/30'}`}
                >
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${habits.sleep ? 'bg-indigo-500 text-[#0D0D0D]' : 'bg-[#252525] text-[#8A8A7A]'}`}>
                         <Moon size={16} fill={habits.sleep ? 'currentColor' : 'none'} />
                      </div>
                      <span className={`font-semibold text-sm ${habits.sleep ? 'text-indigo-400' : 'text-[#F0EDE6]'}`}>Sono Reparador (+7h)</span>
                   </div>
                   <div className={`w-5 h-5 rounded-full border-2 ${habits.sleep ? 'border-indigo-500 bg-indigo-500' : 'border-[#8A8A7A]'}`}></div>
                </button>
             </div>
          </Card>

          {/* GAMIFICAÇÃO BADGES (FRENTE 3) */}
          <Card className="border-[#333333] bg-gradient-to-tr from-[#1A1A1A] to-[#0D0D0D]">
             <h3 className="text-sm font-bold text-[#8A8A7A] uppercase tracking-wider mb-4 px-1 flex items-center justify-between">
                Conquistas <span className="text-[10px] bg-[#D4A947]/10 text-[#D4A947] px-2 py-0.5 rounded-full">Conquistas EC</span>
             </h3>
             <div className="grid grid-cols-2 gap-3">
                
                {/* Badge 1: Mente de Ferro (Streak >= 3) */}
                <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${streak >= 3 ? 'bg-orange-500/10 border-orange-500/50' : 'bg-[#0D0D0D] border-[#333333] opacity-60 grayscale'}`}>
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center ${streak >= 3 ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-[#252525]'}`}>
                      <Flame className="text-[#0D0D0D]" fill="currentColor" size={24} />
                   </div>
                   <div>
                      <p className={`text-xs font-bold ${streak >= 3 ? 'text-orange-500' : 'text-[#8A8A7A]'}`}>Mente de Ferro</p>
                      <p className="text-[9px] text-[#8A8A7A] leading-tight mt-0.5">3 dias seguidos</p>
                   </div>
                </div>

                {/* Badge 2: Elite EC (Month >= 15) */}
                <div className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${monthTotal >= 15 ? 'bg-[#D4A947]/10 border-[#D4A947]/50' : 'bg-[#0D0D0D] border-[#333333] opacity-60 grayscale'}`}>
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center ${monthTotal >= 15 ? 'bg-[#D4A947] shadow-[0_0_15px_rgba(212,169,71,0.5)]' : 'bg-[#252525]'}`}>
                      <Gem className="text-[#0D0D0D]" fill="currentColor" size={24} />
                   </div>
                   <div>
                      <p className={`text-xs font-bold ${monthTotal >= 15 ? 'text-[#D4A947]' : 'text-[#8A8A7A]'}`}>Elite EC</p>
                      <p className="text-[9px] text-[#8A8A7A] leading-tight mt-0.5">15x no Mês</p>
                   </div>
                </div>

             </div>
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
