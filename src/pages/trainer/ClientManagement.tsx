import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../services/firebaseConfig';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Search, Plus, UserCircle, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { UserData } from '../../types';

export const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<UserData | null>(null);
  const { userData } = useAuth();
  
  const [formData, setFormData] = useState({ nome: '', email: '', telefone: '', dataNascimento: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'), 
        where('userType', '==', 'client'),
        where('trainerId', '==', userData?.uid)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => doc.data() as UserData);
      setClients(docs);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.uid) {
      loadClients();
    }
  }, [userData]);

  const handleAddOrEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (editingClient) {
        const clientRef = doc(db, 'users', editingClient.uid);
        await updateDoc(clientRef, {
          nome: formData.nome,
          telefone: formData.telefone,
          dataNascimento: formData.dataNascimento
        });
        toast.success('Cliente atualizado com sucesso!');
      } else {
        if(formData.password.length < 6) {
          toast.error("Senha min. 6 caracteres");
          setIsSubmitting(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        const clientData: UserData = {
          uid: user.uid,
          userType: 'client',
          nome: formData.nome,
          dataNascimento: formData.dataNascimento,
          email: formData.email,
          telefone: formData.telefone,
          dataCriacao: new Date(),
          ultimoAcesso: new Date(),
          ativo: true,
          trainerId: userData?.uid
        };
        await setDoc(doc(db, 'users', user.uid), clientData);
        toast.success('Cliente adicionado com sucesso!');
      }

      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ nome: '', email: '', telefone: '', dataNascimento: '', password: '' });
      loadClients();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email já cadastrado.');
      } else {
        toast.error('Erro ao processar a operação.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingClient || !editingClient.email) return;
    try {
      await sendPasswordResetEmail(auth, editingClient.email);
      toast.success('E-mail de redefinição enviado para o aluno!');
    } catch (error) {
      toast.error('Erro ao enviar e-mail de redefinição.');
    }
  };

  const openNewClientModal = () => {
    setEditingClient(null);
    setFormData({ nome: '', email: '', telefone: '', dataNascimento: '', password: '' });
    setIsModalOpen(true);
  };

  const openEditClientModal = (client: UserData) => {
    setEditingClient(client);
    setFormData({ 
      nome: client.nome, 
      email: client.email, 
      telefone: client.telefone, 
      dataNascimento: client.dataNascimento || '', 
      password: '' 
    });
    setIsModalOpen(true);
  };

  const filtered = clients.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE6]">Gestão de Clientes</h1>
          <p className="text-[#8A8A7A]">Adicione ou gerencie seus alunos</p>
        </div>
        
        <Button onClick={openNewClientModal}>
          <Plus size={20} className="mr-2" />
          Adicionar Cliente
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A7A]" size={18} />
            <Input 
              placeholder="Buscar por nome ou email..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#8A8A7A]">Buscando carteira de alunos...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <div key={c.uid} className="bg-[#252525] p-5 rounded-xl border border-[#333333] flex items-center gap-4 hover:border-[#D4A947]/50 transition-colors cursor-pointer group" onClick={() => openEditClientModal(c)}>
                <UserCircle size={48} className="text-[#8A8A7A]" />
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-semibold text-[#F0EDE6] truncate">{c.nome}</h3>
                  <p className="text-sm text-[#8A8A7A] truncate">{c.email}</p>
                  <div className="flex items-center gap-1 text-[#D4A947] mt-2 text-xs font-medium">
                    <Activity size={12} /> {c.dataNascimento ? 'Verificado' : 'Em andamento'}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 text-xs text-[#8A8A7A] border border-[#333333] px-2 py-1 rounded transition-opacity">Editar</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#8A8A7A]">Nenhum aluno encontrado.</div>
            )}
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? "Editar Cliente" : "Adicionar Novo Cliente"}>
        <form onSubmit={handleAddOrEditClient} className="space-y-4">
          <Input label="Nome Completo" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de Nascimento" type="date" required value={formData.dataNascimento} onChange={e => setFormData({...formData, dataNascimento: e.target.value})} />
            <Input label="Telefone" required value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
          </div>
          
          {!editingClient && (
             <>
                <Input label="Email de Acesso" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <Input label="Senha Provisória" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
             </>
          )}

          {editingClient && (
             <div className="space-y-2 border-t border-[#333333] mt-2 pt-4">
               <h4 className="text-sm font-medium text-[#F0EDE6]">Acesso da Conta</h4>
               <Input label="E-mail Atual do Aluno" type="email" required value={formData.email} disabled />
               <p className="text-xs text-[#8A8A7A] mb-2 leading-relaxed">
                 O Firebase bloqueia a mudança direta de senhas por conta da privacidade do usuário.
                 Para trocar a senha, clique abaixo e o aluno receberá um link oficial no e-mail.
               </p>
               <button type="button" onClick={handleResetPassword} className="text-sm text-[#D4A947] hover:underline">
                 Mandar link de Redefinição de Senha
               </button>
             </div>
          )}

          <div className="pt-4 flex gap-3 justify-end border-t border-[#333333]">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>{editingClient ? "Salvar Alterações" : "Cadastrar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ClientManagement;
