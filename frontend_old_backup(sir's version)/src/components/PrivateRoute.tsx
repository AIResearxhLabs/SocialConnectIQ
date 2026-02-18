import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/signin" />;
  }

  return children;
};

export default PrivateRoute;

export {};
