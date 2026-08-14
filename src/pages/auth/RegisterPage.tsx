import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import toast from 'react-hot-toast';
import type { UserData } from '../../types';

export const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    telefone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if(formData.password.length < 6) {
      toast.error("Sua senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
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
        ativo: true
      };

      await setDoc(doc(db, 'users', user.uid), clientData);
      toast.success('Conta criada com sucesso!');
      navigate('/');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Este email já está cadastrado.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-4 text-[#F0EDE6]">
      <Card className="w-full max-w-md" elevated>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#F0EDE6]">Criar Conta</h1>
          <p className="text-[#8A8A7A] text-sm mt-1">Área exclusiva para alunos do Personal Lázaro Timóteo</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <Input label="Nome Completo" name="nome" type="text" required value={formData.nome} onChange={handleChange} />
          <Input label="Data de Nascimento" name="dataNascimento" type="date" required value={formData.dataNascimento} onChange={handleChange} />
          <Input label="Telefone" name="telefone" type="tel" placeholder="+55..." required value={formData.telefone} onChange={handleChange} />
          <Input label="Email" name="email" type="email" required value={formData.email} onChange={handleChange} />
          <Input label="Senha" name="password" type="password" placeholder="Mínimo 6 caracteres" required value={formData.password} onChange={handleChange} />
          
          <Button type="submit" className="w-full mt-4" isLoading={loading}>
            Confirmar e Entrar
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-[#8A8A7A]">
          Já possui conta? {' '}
          <Link to="/login" className="text-[#D4A947] hover:underline">
            Faça login
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
