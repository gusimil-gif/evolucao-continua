import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Search, Dumbbell, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserData, Exercise, ExerciseDetails, WorkoutPlan, WorkoutDay } from '../../types';

export const WorkoutBuilder: React.FC = () => {
  const { userData } = useAuth();
  
  const [clients, setClients] = useState<UserData[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Plan State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [activeDays, setActiveDays] = useState<string[]>(['Segunda']);
  const [workoutDays, setWorkoutDays] = useState<Record<string, ExerciseDetails[]>>({
    'Segunda': []
  });

  const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  useEffect(() => {
    const fetchData = async () => {
      // Load Clients
      if (userData?.uid) {
        const qClients = query(collection(db, 'users'), where('userType', '==', 'client'), where('trainerId', '==', userData.uid));
        const cSnap = await getDocs(qClients);
        setClients(cSnap.docs.map(d => d.data() as UserData));
      }
      // Load Exercises
      const eSnap = await getDocs(collection(db, 'exercises'));
      setExercises(eSnap.docs.map(d => d.data() as Exercise));
    };
    fetchData();
  }, [userData]);

  useEffect(() => {
    const loadExistingPlan = async () => {
      if (!selectedClient) {
        setEditingPlanId(null);
        setPlanName('');
        setPlanDesc('');
        setActiveDays(['Segunda']);
        setWorkoutDays({'Segunda': []});
        return;
      }
      
      const qPlan = query(collection(db, 'workoutPlans'), where('clientId', '==', selectedClient), where('ativo', '==', true));
      const pSnap = await getDocs(qPlan);
      if (!pSnap.empty) {
        const pDoc = pSnap.docs[0];
        const data = pDoc.data() as WorkoutPlan;
        setEditingPlanId(pDoc.id);
        setPlanName(data.nomePlano);
        setPlanDesc(data.descricao || '');
        setActiveDays(data.diasDaSemana || []);
        
        const qDays = query(collection(db, 'workoutDays'), where('planId', '==', pDoc.id));
        const dSnap = await getDocs(qDays);
        const map: Record<string, ExerciseDetails[]> = {};
        dSnap.docs.forEach(d => {
          const dData = d.data() as WorkoutDay;
          map[dData.diaSemana] = dData.exercicios || [];
        });
        setWorkoutDays(map);
      } else {
        setEditingPlanId(null);
        setPlanName('');
        setPlanDesc('');
        setActiveDays(['Segunda']);
        setWorkoutDays({'Segunda': []});
      }
    };
    loadExistingPlan();
  }, [selectedClient]);

  const addExerciseToDay = (day: string, exercise: Exercise) => {
    const newDetails: ExerciseDetails = {
      exerciseId: exercise.exerciseId,
      ordem: workoutDays[day].length + 1,
      series: 3,
      repeticoes: '10-12',
      descanso: '60s',
      tipoExecucao: 'SIMP',
      observacoes: '',
      tecnica: 'Normal'
    };
    setWorkoutDays(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newDetails]
    }));
  };

  const handleUpdateDetail = (day: string, idx: number, field: keyof ExerciseDetails, value: any) => {
    const newDays = { ...workoutDays };
    newDays[day][idx] = { ...newDays[day][idx], [field]: value };
    setWorkoutDays(newDays);
  };

  const handleSavePlan = async () => {
    if (!selectedClient) return toast.error('Selecione um cliente.');
    if (!planName) return toast.error('Dê um nome ao plano.');

    try {
      // 1. Create or Update Plan
      const payload = {
        clientId: selectedClient,
        trainerId: userData?.uid,
        nomePlano: planName,
        descricao: planDesc,
        dataCriacao: new Date(),
        dataInicio: new Date(),
        dataFim: null,
        ativo: true,
        diasDaSemana: activeDays
      };
      
      let pId = editingPlanId;
      if (editingPlanId) {
        await updateDoc(doc(db, 'workoutPlans', editingPlanId), payload);
        const dq = query(collection(db, 'workoutDays'), where('planId', '==', editingPlanId));
        const ds = await getDocs(dq);
        for(const d of ds.docs) await deleteDoc(d.ref);
      } else {
        const ref = await addDoc(collection(db, 'workoutPlans'), payload);
        pId = ref.id;
      }

      // Create Days
      for (const day of activeDays) {
        if (workoutDays[day]?.length > 0) {
          await addDoc(collection(db, 'workoutDays'), {
            planId: pId,
            diaSemana: day,
            nomeTreino: `Treino de ${day}`,
            ordem: DIAS_SEMANA.indexOf(day),
            exercicios: workoutDays[day]
          });
        }
      }

      toast.success(editingPlanId ? 'Plano atualizado com sucesso!' : 'Plano salvo com sucesso!');
      setPlanName('');
      setWorkoutDays({ 'Segunda': [] });
      setActiveDays(['Segunda']);
    } catch (error) {
      toast.error('Erro ao salvar plano.');
    }
  };

  const handleCopyPlan = async (sourceClientId: string) => {
    try {
      const qPlan = query(collection(db, 'workoutPlans'), where('clientId', '==', sourceClientId), where('ativo', '==', true));
      const pSnap = await getDocs(qPlan);
      if (pSnap.empty) {
        toast.error('Este aluno não possui nenhum plano ativo para copiar.');
        return;
      }

      const planData = pSnap.docs[0].data() as WorkoutPlan;
      const qDays = query(collection(db, 'workoutDays'), where('planId', '==', pSnap.docs[0].id));
      const dSnap = await getDocs(qDays);
      
      const map: Record<string, ExerciseDetails[]> = {};
      dSnap.docs.forEach(d => {
        const dData = d.data() as WorkoutDay;
        map[dData.diaSemana] = dData.exercicios || [];
      });

      setPlanName(planData.nomePlano);
      setPlanDesc(planData.descricao || '');
      setActiveDays(planData.diasDaSemana || []);
      setWorkoutDays(map);
      
      toast.success('Treinos copiados! Faça os ajustes e salve para o cliente alvo.');
    } catch (error) {
      toast.error('Erro ao copiar treinos.');
    }
  };

  const filteredExercises = exercises.filter(e => e.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE6]">Montagem de Treinos</h1>
          <p className="text-[#8A8A7A]">Crie e atribua treinos personalizados</p>
        </div>
        <Button onClick={handleSavePlan}><Save className="mr-2" size={18} /> Salvar Plano</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lado Esquerdo: Configurações e Biblioteca */}
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold mb-4 text-[#F0EDE6]">Configuração do Plano</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#8A8A7A] mb-1 block">Cliente Alvo</label>
                <select 
                  className="w-full bg-[#252525] border border-[#333333] rounded-lg h-10 px-3 text-[#F0EDE6] focus:ring-1 focus:ring-[#D4A947] outline-none"
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => <option key={c.uid} value={c.uid}>{c.nome}</option>)}
                </select>
              </div>

              {selectedClient && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-sm font-medium text-[#D4A947] mb-1 block">Copiar de outro aluno</label>
                  <select 
                    className="w-full bg-[#252525] border border-[#D4A947]/30 rounded-lg h-10 px-3 text-[#D4A947] focus:ring-1 focus:ring-[#D4A947] outline-none text-sm cursor-pointer"
                    value=""
                    onChange={e => {
                      if (e.target.value) {
                        handleCopyPlan(e.target.value);
                      }
                    }}
                  >
                    <option value="">Copiar treinos de...</option>
                    {clients.filter(c => c.uid !== selectedClient).map(c => (
                      <option key={c.uid} value={c.uid}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              <Input label="Nome do Plano" placeholder="Ex: Hipertrofia Módulo 1" value={planName} onChange={e => setPlanName(e.target.value)} />
              <Input label="Descrição Curta" placeholder="Foco em membros superiores" value={planDesc} onChange={e => setPlanDesc(e.target.value)} />
              
              <div>
                <label className="text-sm font-medium text-[#8A8A7A] mb-2 block">Dias Ativos</label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map(dia => (
                    <button
                      key={dia}
                      onClick={() => {
                        const newDays = activeDays.includes(dia) ? activeDays.filter(d => d !== dia) : [...activeDays, dia];
                        setActiveDays(newDays);
                        if (!workoutDays[dia]) setWorkoutDays(prev => ({...prev, [dia]: []}));
                      }}
                      className={`px-3 py-1 rounded-full text-sm border ${activeDays.includes(dia) ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]' : 'bg-[#252525] border-[#333333] text-[#8A8A7A]'}`}
                    >
                      {dia}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex-1">
            <h2 className="font-semibold mb-4 text-[#F0EDE6]">Biblioteca Rápida</h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A7A]" size={16} />
              <input 
                placeholder="Buscar exercício..." 
                className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg h-9 pl-9 pr-3 text-sm text-[#F0EDE6]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="h-64 overflow-y-auto space-y-2 pr-2">
              {filteredExercises.map(ex => (
                <div key={ex.exerciseId} className="bg-[#252525] p-3 rounded-lg flex justify-between items-center group">
                  <div className="truncate flex-1">
                    <p className="text-sm font-medium text-[#F0EDE6] truncate">{ex.nome}</p>
                    <p className="text-xs text-[#8A8A7A]">{ex.grupoMuscular}</p>
                  </div>
                  {/* Seletor rápido de qual dia adicionar */}
                  <select 
                    className="ml-2 bg-[#1A1A1A] text-xs h-7 rounded border border-[#333333] text-[#F0EDE6] outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                    onChange={(e) => {
                      if(e.target.value) {
                         addExerciseToDay(e.target.value, ex);
                         e.target.value = '';
                      }
                    }}
                  >
                    <option value="">+ Dia</option>
                    {activeDays.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Lado Direito: Workspace por Dias */}
        <div className="lg:col-span-2 space-y-6">
          {activeDays.length === 0 ? (
             <div className="text-center py-20 text-[#8A8A7A]">Nenhum dia selecionado para este plano.</div>
          ) : (
             activeDays.map(day => (
               <Card key={day}>
                 <h2 className="text-lg font-bold text-[#F0EDE6] mb-4 border-b border-[#333333] pb-2">{day}</h2>
                 
                 <div className="space-y-3">
                   {workoutDays[day]?.map((detail, idx) => {
                     const exMeta = exercises.find(e => e.exerciseId === detail.exerciseId);
                     return (
                       <div key={idx} className="bg-[#0D0D0D] p-4 rounded-lg border border-[#333333]">
                         <div className="flex justify-between items-center mb-3">
                           <h4 className="font-semibold text-[#D4A947] flex items-center gap-2">
                             <Dumbbell size={16} /> {exMeta?.nome || 'Exercício Desconhecido'}
                           </h4>
                           <button 
                             onClick={() => {
                               const newDays = {...workoutDays};
                               newDays[day] = newDays[day].filter((_, i) => i !== idx);
                               setWorkoutDays(newDays);
                             }}
                             className="text-red-500 hover:text-red-400 text-xs font-medium"
                           >
                             Remover
                           </button>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           <Input label="Séries" type="number" value={detail.series} onChange={e => handleUpdateDetail(day, idx, 'series', Number(e.target.value))} />
                           <Input label="Repetições" placeholder="ex: 10-12" value={detail.repeticoes} onChange={e => handleUpdateDetail(day, idx, 'repeticoes', e.target.value)} />
                           <Input label="Descanso" placeholder="ex: 60s" value={detail.descanso} onChange={e => handleUpdateDetail(day, idx, 'descanso', e.target.value)} />
                           <div>
                              <label className="text-sm font-medium text-[#8A8A7A] mb-1 block">Tipo de Execução</label>
                              <select 
                                className="w-full bg-[#252525] border border-[#333333] rounded-lg h-10 px-3 text-[#F0EDE6] outline-none text-sm"
                                value={detail.tipoExecucao}
                                onChange={e => handleUpdateDetail(day, idx, 'tipoExecucao', e.target.value)}
                             >
                               <option value="SIMP">SIMP (Série Normal)</option>
                               <option value="COMP">COMP (Aquecimento + Trabalho)</option>
                             </select>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                   
                   {(!workoutDays[day] || workoutDays[day].length === 0) && (
                      <div className="text-center py-6 border-2 border-dashed border-[#333333] rounded-lg text-[#8A8A7A] text-sm">
                        Adicione exercícios a este dia usando a biblioteca lateral.
                      </div>
                   )}
                 </div>
               </Card>
             ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkoutBuilder;
