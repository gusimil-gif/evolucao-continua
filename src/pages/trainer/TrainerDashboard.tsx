import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Activity, CheckCircle2, PlusCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { UserData, WorkoutLog } from '../../types';

interface ActivityFeedItem {
  id: string;
  clientName: string;
  planId: string;
  date: Date;
  timeSpent: number;
  rpe?: number;
  feedback?: string;
}

export const TrainerDashboard: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);
  const [totalPlans, setTotalPlans] = useState(0);
  const [monthlyWorkouts, setMonthlyWorkouts] = useState(0);
  const [recentActivities, setRecentActivities] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userData?.uid) return;
      
      try {
        // 1. Fetch Clients
        const qClients = query(collection(db, 'users'), where('userType', '==', 'client'), where('trainerId', '==', userData.uid));
        const cSnap = await getDocs(qClients);
        const clients = cSnap.docs.map(d => d.data() as UserData);
        setTotalClients(clients.length);

        // 2. Fetch Active Plans
        const qPlans = query(collection(db, 'workoutPlans'), where('trainerId', '==', userData.uid), where('ativo', '==', true));
        const pSnap = await getDocs(qPlans);
        setTotalPlans(pSnap.docs.length);

        // 3. Fetch All Logs & Filter for these clients (Client-side join to avoid complex indexes)
        // If the platform scaled massively, we'd use robust Cloud Functions or composite index chunking.
        const logsSnap = await getDocs(collection(db, 'workoutLogs'));
        const allLogs = logsSnap.docs.map(l => l.data() as WorkoutLog);
        
        const clientIds = clients.map(c => c.uid);
        const myClientLogs = allLogs.filter(l => clientIds.includes(l.clientId) && l.concluido === true && l.dataExecucao);
        
        // Calcular Logs do Mês
        const currMonth = new Date().getMonth();
        const currYear = new Date().getFullYear();
        let monCount = 0;
        
        const activities: ActivityFeedItem[] = [];

        myClientLogs.forEach(log => {
          const dt = log.dataExecucao.toDate();
          if (dt.getMonth() === currMonth && dt.getFullYear() === currYear) monCount++;
          
          const client = clients.find(c => c.uid === log.clientId);
          if (client) {
            activities.push({
              id: log.logId,
              clientName: client.nome,
              planId: log.planId,
              date: dt,
              timeSpent: log.tempoTotal || 0,
              rpe: log.rpe,
              feedback: log.feedbackAluno,
            });
          }
        });
        
        setMonthlyWorkouts(monCount);
        
        // Ordenar Atividades Recentes (Mais novas 1o) e Limitar a 6
        activities.sort((a,b) => b.date.getTime() - a.date.getTime());
        setRecentActivities(activities.slice(0, 6));

      } catch (e) {
        console.error("Erro ao carregar os dados:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [userData]);

  if (loading) {
    return <div className="p-6 text-[#8A8A7A] flex justify-center mt-20 animate-pulse">Consultando banco de dados gerencial...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#F0EDE6]">Painel de Controle</h1>
        <p className="text-[#8A8A7A] mt-1 text-sm font-medium">Visão geral da sua assessoria fitness</p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center gap-4 bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-[#333333] hover:border-[#D4A947]/40 transition-colors group">
          <div className="w-14 h-14 rounded-full bg-[#0D0D0D] flex items-center justify-center border border-[#333333] group-hover:shadow-[0_0_15px_rgba(212,169,71,0.2)]">
            <Users className="text-[#D4A947] w-6 h-6" />
          </div>
          <div>
            <p className="text-[#8A8A7A] text-xs font-bold uppercase tracking-wider mb-1">Total de Alunos</p>
            <h3 className="text-3xl font-black text-[#F0EDE6]">{totalClients}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-[#333333] hover:border-[#D4A947]/40 transition-colors group">
          <div className="w-14 h-14 rounded-full bg-[#0D0D0D] flex items-center justify-center border border-[#333333] group-hover:shadow-[0_0_15px_rgba(212,169,71,0.2)]">
            <FileText className="text-[#D4A947] w-6 h-6" />
          </div>
          <div>
            <p className="text-[#8A8A7A] text-xs font-bold uppercase tracking-wider mb-1">Planos Ativos</p>
            <h3 className="text-3xl font-black text-[#F0EDE6]">{totalPlans}</h3>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-[#D4A947]/20 hover:border-[#D4A947]/40 transition-colors group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4A947]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="w-14 h-14 rounded-full bg-[#0D0D0D] flex items-center justify-center border border-[#333333] group-hover:shadow-[0_0_15px_rgba(212,169,71,0.2)] relative z-10">
            <Activity className="text-[#D4A947] w-6 h-6 animate-pulse" />
          </div>
          <div className="relative z-10">
            <p className="text-[#8A8A7A] text-xs font-bold uppercase tracking-wider mb-1">Balanço do Mês</p>
            <h3 className="text-3xl font-black text-[#F0EDE6] flex items-baseline gap-2">
              {monthlyWorkouts} <span className="text-xs font-normal text-[#8A8A7A] lowercase">treinos feitos</span>
            </h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Atividades Recentes Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-[#F0EDE6] flex items-center gap-2 px-1">
            <CheckCircle2 className="text-[#D4A947] w-5 h-5" /> Atividade dos Alunos
          </h2>
          
          <Card className="min-h-[300px]">
             {recentActivities.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#8A8A7A] py-12">
                   <Activity className="w-12 h-12 mb-3 opacity-20" />
                   <p>Nenhuma conclusão logada pelos alunos ainda.</p>
                </div>
             ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[#333333] before:to-transparent">
                  {recentActivities.map((act, i) => {
                     const isCritical = act.rpe === 4 || act.rpe === 5 || (act.feedback && act.feedback.length > 0);
                     
                     return (
                       <div key={act.id + i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                         {/* Pontinho da Timeline */}
                         <div className={`flex items-center justify-center w-8 h-8 rounded-full border-[3px] border-[#0D0D0D] shadow-[0_0_10px_rgba(212,169,71,0.4)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 absolute left-0 md:left-1/2 z-10 transform -translate-x-1/2 transition-colors ${
                           isCritical ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-[#D4A947]'
                         }`}>
                            <CheckCircle2 width={14} height={14} className="text-[#0D0D0D]" />
                         </div>
                         
                         {/* Card da Atividade */}
                         <div className={`w-[calc(100%-2.5rem)] md:w-[calc(50%-2.5rem)] ml-auto md:ml-0 p-4 rounded-xl border bg-[#1A1A1A] transition-colors ${
                           isCritical ? 'border-amber-500/40 hover:border-amber-500' : 'border-[#333333] group-hover:border-[#D4A947]/40'
                         }`}>
                           <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-[#F0EDE6] flex items-center gap-2">
                                {act.clientName} 
                                {isCritical && <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded uppercase tracking-wider">Atenção</span>}
                              </h4>
                              <span className={`text-xs font-semibold ${isCritical ? 'text-amber-500' : 'text-[#D4A947]'}`}>{formatDistanceToNow(act.date, { addSuffix: true, locale: ptBR })}</span>
                           </div>
                           <p className="text-xs text-[#8A8A7A] mb-2">Concluiu o treino do dia em {(act.timeSpent / 60).toFixed(0)} min.</p>
                           
                           {(act.rpe || act.feedback) && (
                             <div className="mt-2 pt-2 border-t border-[#333333]/50 space-y-1">
                               {act.rpe && (
                                  <p className="text-xs font-medium text-[#F0EDE6]">
                                     Percepção: <span className={act.rpe >= 4 ? 'text-amber-500 font-bold' : 'text-[#D4A947]'}>{act.rpe} / 5</span>
                                  </p>
                               )}
                               {act.feedback && (
                                  <p className="text-[11px] text-[#8A8A7A] italic border-l-2 border-amber-500/50 pl-2">
                                    "{act.feedback}"
                                  </p>
                               )}
                             </div>
                           )}
                         </div>
                       </div>
                     );
                  })}
                </div>
             )}
          </Card>
        </div>

        {/* Atalhos Rápidos */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#F0EDE6] px-1">Ações Rápidas</h2>
          <Card className="flex flex-col gap-3">
             <button 
                onClick={() => navigate('/trainer/clients')}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#252525] border border-[#333333] hover:border-[#D4A947] hover:bg-[#D4A947]/5 transition-all group"
             >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0D0D0D] flex items-center justify-center">
                    <PlusCircle size={16} className="text-[#8A8A7A] group-hover:text-[#D4A947]" />
                  </div>
                  <span className="font-semibold text-[#F0EDE6]">Adicionar Aluno</span>
                </div>
                <ChevronRight size={18} className="text-[#8A8A7A] group-hover:text-[#D4A947] transition-colors" />
             </button>

             <button 
                onClick={() => navigate('/trainer/workouts')}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#252525] border border-[#333333] hover:border-[#D4A947] hover:bg-[#D4A947]/5 transition-all group"
             >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0D0D0D] flex items-center justify-center">
                    <FileText size={16} className="text-[#8A8A7A] group-hover:text-[#D4A947]" />
                  </div>
                  <span className="font-semibold text-[#F0EDE6]">Criar Plano</span>
                </div>
                <ChevronRight size={18} className="text-[#8A8A7A] group-hover:text-[#D4A947] transition-colors" />
             </button>
             
             <button 
                onClick={() => navigate('/trainer/exercises')}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#252525] border border-[#333333] hover:border-[#D4A947] hover:bg-[#D4A947]/5 transition-all group"
             >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0D0D0D] flex items-center justify-center">
                    <Activity size={16} className="text-[#8A8A7A] group-hover:text-[#D4A947]" />
                  </div>
                  <span className="font-semibold text-[#F0EDE6]">Base de Exercícios</span>
                </div>
                <ChevronRight size={18} className="text-[#8A8A7A] group-hover:text-[#D4A947] transition-colors" />
             </button>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default TrainerDashboard;
