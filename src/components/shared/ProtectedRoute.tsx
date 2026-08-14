import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserType } from '../../types';

interface Props {
  children: React.ReactNode;
  allowedType: UserType;
}

export const ProtectedRoute: React.FC<Props> = ({ children, allowedType }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
        <div className="w-10 h-10 border-4 border-[#D4A947] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userData && userData.userType !== allowedType) {
    // Redireciona para o painel correto caso o tipo não bata
    return <Navigate to={userData.userType === 'trainer' ? '/trainer' : '/client'} replace />;
  }

  return <>{children}</>;
};
