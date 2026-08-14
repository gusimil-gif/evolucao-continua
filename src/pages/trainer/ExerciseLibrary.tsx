import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, Play, Edit2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Exercise } from '../../types';

export const ExerciseLibrary: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { userData } = useAuth();
  
  // Form State
  const [formData, setFormData] = useState<Partial<Exercise>>({});

  const loadExercises = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'exercises'));
      const docs = snapshot.docs.map(doc => doc.data() as Exercise);
      // Ordenação local (em memória) para não depender de índices complexos no Firestore
      docs.sort((a, b) => {
        if (a.grupoMuscular < b.grupoMuscular) return -1;
        if (a.grupoMuscular > b.grupoMuscular) return 1;
        return a.nome.localeCompare(b.nome);
      });
      setExercises(docs);
    } catch (error) {
      toast.error('Erro ao carregar exercícios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.grupoMuscular || !formData.equipamento) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const isNew = !formData.exerciseId;
      const ref = isNew ? doc(collection(db, 'exercises')) : doc(db, 'exercises', formData.exerciseId as string);
      
      const payload: Exercise = {
        exerciseId: ref.id,
        nome: formData.nome || '',
        grupoMuscular: formData.grupoMuscular || '',
        equipamento: formData.equipamento || '',
        dificuldade: formData.dificuldade || 'Iniciante',
        descricao: formData.descricao || '',
        videoUrl: formData.videoUrl || '',
        videoUrlPadrao: formData.videoUrlPadrao || formData.videoUrl || '',
        criadoPor: formData.criadoPor || (isNew ? (userData?.uid || 'trainer') : 'system'),
        ativo: formData.ativo !== undefined ? formData.ativo : true,
        subgrupo: formData.subgrupo || ''
      };

      await setDoc(ref, payload);
      toast.success('Exercício salvo!');
      setIsModalOpen(false);
      loadExercises();
    } catch (error) {
      toast.error('Erro ao salvar');
    }
  };

  const filtered = exercises.filter(ex => 
    ex.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ex.grupoMuscular.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE6]">Biblioteca de Exercícios</h1>
          <p className="text-[#8A8A7A]">Gerencie a base de exercícios e links do YouTube</p>
        </div>
        
        <Button onClick={() => { setFormData({ criadoPor: userData?.uid }); setIsModalOpen(true); }}>
          <Plus size={20} className="mr-2" />
          Novo Exercício
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A7A]" size={18} />
            <Input 
              placeholder="Buscar exercício ou grupo..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#8A8A7A]">Carregando exercícios...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(ex => (
              <div key={ex.exerciseId} className="bg-[#252525] p-4 rounded-xl border border-[#333333] flex flex-col justify-between hover:border-[#D4A947]/50 transition-colors">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-[#F0EDE6]">{ex.nome}</h3>
                    <button 
                      onClick={() => { setFormData(ex); setIsModalOpen(true); }}
                      className="text-[#8A8A7A] hover:text-[#D4A947] p-1"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[#8A8A7A] mb-4">
                    <span className="px-2 py-1 bg-[#1A1A1A] rounded-md">{ex.grupoMuscular}</span>
                    <span className="px-2 py-1 bg-[#1A1A1A] rounded-md">{ex.equipamento}</span>
                  </div>
                </div>
                
                {ex.videoUrl ? (
                  <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#D4A947] text-sm hover:underline font-medium">
                    <Play size={16} fill="currentColor" /> Ver Vídeo
                  </a>
                ) : (
                  <span className="text-sm text-[#8A8A7A]">Sem vídeo</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#8A8A7A]">Nenhum exercício encontrado.</div>
            )}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.exerciseId ? 'Editar Exercício' : 'Novo Exercício'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input 
            label="Nome do Exercício" 
            required 
            value={formData.nome || ''} 
            onChange={e => setFormData({...formData, nome: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Grupo Muscular" 
              required 
              value={formData.grupoMuscular || ''} 
              onChange={e => setFormData({...formData, grupoMuscular: e.target.value})} 
              placeholder="Ex: Peito"
            />
            <Input 
              label="Equipamento" 
              required 
              value={formData.equipamento || ''} 
              onChange={e => setFormData({...formData, equipamento: e.target.value})} 
            />
          </div>
          <Input 
            label="Link do YouTube" 
            type="url"
            value={formData.videoUrl || ''} 
            onChange={e => setFormData({...formData, videoUrl: e.target.value})} 
            placeholder="https://youtube.com/..."
          />
          <div className="pt-4 flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExerciseLibrary;
