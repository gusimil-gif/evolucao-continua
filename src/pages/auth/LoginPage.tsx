import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O RootRedirect ou ProtectedRoute cuidará do roteamento na Home/Auth.
      navigate('/');
    } catch (error: any) {
      toast.error('Email ou senha incorretos. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetModal = () => {
    setResetEmail(email || '');
    setIsResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Informe seu e-mail para recuperar a senha.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Link de recuperação enviado! Verifique seu e-mail (inclusive a pasta de Spam).');
      setIsResetModalOpen(false);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast.error('Nenhum usuário encontrado com este e-mail.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('E-mail inválido.');
      } else {
        toast.error('Erro ao enviar e-mail de recuperação. Tente novamente.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-4 text-[#F0EDE6]">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700" elevated>
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" />
          <p className="text-[#8A8A7A] text-sm mt-3 font-medium uppercase tracking-widest">Corpo • Mente • Disciplina • Resultados</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            label="Email"
            type="email" 
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-1">
            <Input 
              label="Senha"
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleOpenResetModal}
                className="text-xs text-[#D4A947] hover:underline transition-colors font-medium cursor-pointer"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>
          
          <Button type="submit" className="w-full mt-2" isLoading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-[#8A8A7A]">
          Não possui conta? {' '}
          <Link to="/register" className="text-[#D4A947] hover:underline">
            Cadastre-se como aluno
          </Link>
        </div>
      </Card>

      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Recuperar Senha"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-[#8A8A7A] leading-relaxed">
            Informe o e-mail cadastrado na sua conta. Você receberá um link oficial do sistema para cadastrar sua nova senha.
          </p>
          <Input
            label="E-mail cadastrado"
            type="email"
            placeholder="seu@email.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
          />
          <div className="flex gap-3 justify-end pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsResetModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={resetLoading}
            >
              Enviar Link
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LoginPage;
