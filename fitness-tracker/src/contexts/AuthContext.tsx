import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  onUserChange?: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider: React.FC<{ children: React.ReactNode; onUserChange?: (user: User | null) => void }> = ({ children, onUserChange }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);
      if (onUserChange) {
        onUserChange(newUser);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);
      if (onUserChange) {
        onUserChange(newUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [onUserChange]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Note: We don't clear Stripe customer IDs on logout because they should 
    // persist for each user to maintain subscription continuity
    // User change will be handled by the auth state change listener
  };

  const value = {
    user,
    loading,
    signOut,
    onUserChange,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 