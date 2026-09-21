import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Activity, 
  CheckCircle2, 
  PlusCircle, 
  ChevronRight, 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import type { UserData, WorkoutLog, WorkoutPlan, CoachDebrief } from '../../types';

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
  const [coachDebriefs, setCoachDebriefs] = useState<CoachDebrief[]>([]);
  const [allClientsList, setAllClientsList] = useState<UserData[]>([]);
  const [debriefFilter, setDebriefFilter] = useState<'all' | 'pain' | 'loads'>('all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userData?.uid) return;
      
      try {
        const isAdmin = userData.email === 'admin@evolucaocontinua.app';

        // 1. Consultas paralelas ultra-rápidas com Promise.all
        const qClients = query(collection(db, 'users'), where('userType', '==', 'client'));
        const qPlans = query(collection(db, 'workoutPlans'), where('ativo', '==', true));
        const qLogs = query(collection(db, 'workoutLogs'));
        const qDebriefs = query(collection(db, 'coachDebriefs'), orderBy('data', 'desc'), limit(25));

        const [cSnap, pSnap, logsSnap, debSnap] = await Promise.all([
          getDocs(qClients),
          getDocs(qPlans),
          getDocs(qLogs),
          getDocs(qDebriefs).catch(() => ({ docs: [] } as any))
        ]);

        let clients = cSnap.docs.map(d => d.data() as UserData);
        if (!isAdmin && userData.userType === 'trainer') {
          const assigned = clients.filter(c => !c.trainerId || c.trainerId === userData.uid || c.trainerId === 'piVnSDRpv8SOpmdSzmDbpWCSwFc2');
          if (assigned.length > 0) clients = assigned;
        }
        setTotalClients(clients.length);
        setAllClientsList(clients);

        const plans = pSnap.docs.map(d => d.data() as WorkoutPlan);
        const myPlans = isAdmin ? plans : plans.filter(p => !p.trainerId || p.trainerId === userData.uid || p.trainerId === 'piVnSDRpv8SOpmdSzmDbpWCSwFc2');
        setTotalPlans(myPlans.length);

        // 2. Filtrar logs dos clientes
        const allLogs = logsSnap.docs.map(l => l.data() as WorkoutLog);
        const clientIds = clients.map(c => c.uid);
        const myClientLogs = allLogs.filter(l => clientIds.includes(l.clientId) && l.concluido === true && l.dataExecucao);
        
        // Calcular Logs do Mês
        const currMonth = new Date().getMonth();
        const currYear = new Date().getFullYear();
        let monCount = 0;
        
        const activities: ActivityFeedItem[] = [];

        myClientLogs.forEach(log => {
          const dt = log.dataExecucao.toDate ? log.dataExecucao.toDate() : new Date(log.dataExecucao);
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

        // 3. Debriefs do Coach IA
        if (debSnap && debSnap.docs) {
          const rawDebriefs = debSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CoachDebrief));
          // Filtra para mostrar debriefs dos alunos relevantes
          const filteredDebriefs = isAdmin 
            ? rawDebriefs 
            : rawDebriefs.filter((d: any) => clientIds.includes(d.clientId) || d.trainerId === userData.uid || d.trainerId === 'piVnSDRpv8SOpmdSzmDbpWCSwFc2');
          setCoachDebriefs(filteredDebriefs);
        }

      } catch (e) {
        console.error("Erro ao carregar os dados:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [userData]);

  const handleAcknowledgeDebrief = async (debriefId: string) => {
    try {
      await updateDoc(doc(db, 'coachDebriefs', debriefId), { status: 'ciente' });
      setCoachDebriefs(prev => prev.map(d => d.id === debriefId ? { ...d, status: 'ciente' } : d));
      toast.success("Check-in marcado como ciente!");
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  };

  const activePainAlertsCount = coachDebriefs.filter(d => d.alertasDor && d.alertasDor.length > 0 && d.status !== 'ciente').length;
  const loadProgressionsCount = coachDebriefs.filter(d => d.cargasExtraidas && d.cargasExtraidas.length > 0).length;

  if (loading) {
    return <div className="p-6 text-[#8A8A7A] flex justify-center mt-20 animate-pulse">Consultando banco de dados gerencial...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 w-full max-w-full overflow-x-hidden">
      
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

      {/* ============================================================ */}
      {/* RADAR DO COACH IA & ALERTAS DE LESÃO DOS ALUNOS               */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#D4A947]/10 flex items-center justify-center text-[#D4A947] border border-[#D4A947]/30">
                <Sparkles size={18} />
              </div>
              <h2 className="text-xl font-black text-[#F0EDE6] tracking-tight">
                Radar do Coach IA & Alertas dos Alunos
              </h2>
              {activePainAlertsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500 text-red-400 text-xs font-bold animate-pulse flex items-center gap-1">
                  <ShieldAlert size={12} /> {activePainAlertsCount} Alerta(s) Articular(es)
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A8A7A]">
              Monitoramento biomecânico contínuo: progressão de cargas sem digitação manual e detecção precoce de dores articulares.
            </p>
          </div>

          {/* Filtros de Visualização */}
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] p-1 rounded-xl border border-[#333333]">
            <button
              onClick={() => setDebriefFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                debriefFilter === 'all'
                  ? 'bg-[#D4A947] text-[#0D0D0D] shadow'
                  : 'text-[#8A8A7A] hover:text-[#F0EDE6]'
              }`}
            >
              Todos ({coachDebriefs.length})
            </button>
            <button
              onClick={() => setDebriefFilter('pain')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                debriefFilter === 'pain'
                  ? 'bg-amber-500 text-[#0D0D0D] shadow'
                  : activePainAlertsCount > 0
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-[#8A8A7A] hover:text-[#F0EDE6]'
              }`}
            >
              <AlertTriangle size={12} /> Dores / Alertas ({activePainAlertsCount})
            </button>
            <button
              onClick={() => setDebriefFilter('loads')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                debriefFilter === 'loads'
                  ? 'bg-[#D4A947] text-[#0D0D0D] shadow'
                  : 'text-[#8A8A7A] hover:text-[#F0EDE6]'
              }`}
            >
              <TrendingUp size={12} /> Cargas ({loadProgressionsCount})
            </button>
          </div>
        </div>

        {/* Lista de Check-ins IA */}
        {coachDebriefs.length === 0 ? (
          <Card className="p-8 text-center bg-[#1A1A1A] border-[#333333] space-y-2">
            <Sparkles className="w-10 h-10 text-[#D4A947]/40 mx-auto animate-pulse" />
            <p className="text-sm font-semibold text-[#F0EDE6]">Nenhum check-in de aluno registrado ainda.</p>
            <p className="text-xs text-[#8A8A7A] max-w-md mx-auto">
              Assim que seus alunos utilizarem o <strong>Coach IA</strong> pós-treino (por voz ou texto), as evoluções de carga e alertas preventivos aparecerão aqui em tempo real.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coachDebriefs
              .filter(d => {
                if (debriefFilter === 'pain') return d.alertasDor && d.alertasDor.length > 0;
                if (debriefFilter === 'loads') return d.cargasExtraidas && d.cargasExtraidas.length > 0;
                return true;
              })
              .map((deb) => {
                const clientObj = allClientsList.find(c => c.uid === deb.clientId);
                const hasPain = deb.alertasDor && deb.alertasDor.length > 0;
                const isAcknowledged = deb.status === 'ciente';
                const cleanPhone = clientObj?.telefone?.replace(/\D/g, '') || '';
                
                // Mensagem personalizada para WhatsApp do treinador para o aluno
                const waFirstAlert = hasPain ? deb.alertasDor[0] : null;
                const waText = waFirstAlert
                  ? `Olá ${deb.clientName}! Aqui é o ${userData?.nome || 'seu Personal'}. Vi seu check-in com o Coach IA sobre o desconforto no ${waFirstAlert.articulacao}. Como você está se sentindo agora? Vamos ajustar a execução no próximo treino.`
                  : `Olá ${deb.clientName}! Parabéns pelo treino e pela progressão de cargas no check-in do Coach IA! Continue firme!`;
                const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(waText)}` : null;

                const debDate = deb.data?.toDate ? deb.data.toDate() : new Date(deb.data || Date.now());

                return (
                  <Card 
                    key={deb.id} 
                    className={`p-5 bg-[#1A1A1A] transition-all space-y-3 relative overflow-hidden ${
                      hasPain && !isAcknowledged
                        ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : 'border-[#333333] hover:border-[#D4A947]/40'
                    }`}
                  >
                    {/* Linha Superior: Nome do Aluno, Treino e Data */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#F0EDE6] text-base">{deb.clientName}</h4>
                          {hasPain && (
                            <span className="text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-400 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle size={10} /> Alerta Articular
                            </span>
                          )}
                          {isAcknowledged && (
                            <span className="text-[10px] bg-[#252525] text-[#8A8A7A] border border-[#333333] px-2 py-0.5 rounded flex items-center gap-1">
                              <Check size={10} /> Ciente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8A8A7A] mt-0.5">
                          {deb.nomeTreino || 'Check-in de Treino'} • RPE: <strong className="text-[#D4A947]">{deb.rpe || 8.0}/10</strong>
                        </p>
                      </div>

                      <span className="text-[11px] text-[#8A8A7A] shrink-0 font-medium">
                        {formatDistanceToNow(debDate, { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>

                    {/* Relato do Aluno */}
                    <div className="p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] text-xs text-[#8A8A7A] italic">
                      "{deb.transcricao}"
                    </div>

                    {/* Dores / Alertas Articulares com Orientação Biomecânica */}
                    {hasPain && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <ShieldAlert size={14} />
                            Região Afetada: {deb.alertasDor.map(a => a.articulacao.toUpperCase()).join(', ')}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                            Gravidade: {deb.alertasDor[0].gravidade}
                          </span>
                        </div>
                        <p className="text-xs text-[#F0EDE6]">
                          <strong className="text-amber-400">Sugestão de Intervenção:</strong> {deb.alertasDor[0].orientacaoBiomecanica}
                        </p>
                      </div>
                    )}

                    {/* Cargas Extraídas e Sincronizadas */}
                    {deb.cargasExtraidas && deb.cargasExtraidas.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-bold text-[#8A8A7A] uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp size={12} className="text-[#D4A947]" />
                          Cargas Sincronizadas Automaticamente:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {deb.cargasExtraidas.map((c, i) => (
                            <span 
                              key={i} 
                              className="text-xs bg-[#252525] border border-[#333333] text-[#F0EDE6] px-2.5 py-1 rounded-md flex items-center gap-1.5"
                            >
                              <span className="font-semibold">{c.nomeExercicio}:</span>
                              <strong className="text-[#D4A947]">{c.carga}kg</strong>
                              {c.delta && c.delta > 0 && (
                                <span className="text-emerald-400 text-[10px] font-bold">+{c.delta}kg</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ações Rápidas do Treinador */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#333333]">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <MessageSquare size={14} />
                          <span>Falar no WhatsApp</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#8A8A7A]">Sem telefone cadastrado</span>
                      )}

                      {!isAcknowledged ? (
                        <button
                          onClick={() => handleAcknowledgeDebrief(deb.id!)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A8A7A] hover:text-[#F0EDE6] bg-[#252525] hover:bg-[#333333] border border-[#333333] px-2.5 py-1.5 rounded-lg transition-all"
                        >
                          <Check size={14} />
                          <span>Marcar Ciente</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#8A8A7A] flex items-center gap-1">
                          <Check size={12} className="text-[#D4A947]" /> Ciente registrado
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
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
