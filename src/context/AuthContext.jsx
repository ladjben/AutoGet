import { createContext, useContext, useState, useEffect } from 'react';
import { USE_SUPABASE } from '../config';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext();

// Comptes par défaut - REMOVED pour ne pas afficher de comptes de démonstration
const DEFAULT_ACCOUNTS = [];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      if (USE_SUPABASE) {
        // Login avec Supabase
        const { data, error } = await supabase
          .from('comptes')
          .select('id, username, nom, role, active')
          .eq('username', username)
          .eq('password', password)
          .eq('active', true)
          .single();

        if (error) {
          console.error('Erreur login Supabase:', error);
          return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
        }

        if (!data) {
          return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
        }

        // User found, set state
        const userData = {
          id: data.id,
          username: data.username,
          name: data.nom,
          role: data.role || 'user'
        };

        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        return { success: true };
      } else {
        // Login avec localStorage (fallback)
        let accounts = JSON.parse(localStorage.getItem('auth_accounts')) || DEFAULT_ACCOUNTS;
        
        const foundUser = accounts.find(
          acc => acc.username === username && acc.password === password
        );

        if (foundUser) {
          const { password: _, ...userWithoutPassword } = foundUser;
          setUser(userWithoutPassword);
          localStorage.setItem('auth_user', JSON.stringify(userWithoutPassword));
          return { success: true };
        }

        return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
      }
    } catch (error) {
      console.error('Erreur login:', error);
      return { success: false, error: 'Une erreur est survenue lors de la connexion' };
    }
  };

  const signup = async ({ username, password, name, role = 'user' }) => {
    try {
      if (USE_SUPABASE) {
        // Vérifier si le username existe déjà dans Supabase
        const { data: existingUser, error: checkError } = await supabase
          .from('comptes')
          .select('id')
          .eq('username', username)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 = no rows returned (ce qu'on veut)
          console.error('Erreur vérification username:', checkError);
          return { success: false, error: 'Erreur lors de la vérification du nom d\'utilisateur' };
        }

        if (existingUser) {
          return { success: false, error: 'Ce nom d\'utilisateur existe déjà' };
        }

        // Créer le nouveau compte dans Supabase
        const { data: newAccount, error: insertError } = await supabase
          .from('comptes')
          .insert([
            {
              username,
              password, // En production, il faudrait hasher le mot de passe
              nom: name || username,
              role: role || 'user',
              active: true
            }
          ])
          .select('id, username, nom, role, active')
          .single();

        if (insertError) {
          console.error('Erreur insertion Supabase:', insertError);
          return { 
            success: false, 
            error: insertError.message || 'Erreur lors de la création du compte' 
          };
        }

        if (!newAccount) {
          return { success: false, error: 'Erreur lors de la création du compte' };
        }

        // Auto login after signup
        const userData = {
          id: newAccount.id,
          username: newAccount.username,
          name: newAccount.nom,
          role: newAccount.role || 'user'
        };

        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));

        return { success: true };
      } else {
        // Fallback localStorage
        let accounts = JSON.parse(localStorage.getItem('auth_accounts')) || DEFAULT_ACCOUNTS;
        
        if (accounts.find(acc => acc.username === username)) {
          return { success: false, error: 'Ce nom d\'utilisateur existe déjà' };
        }
        
        const newAccount = {
          id: `user_${Date.now()}`,
          username,
          password,
          role: role || 'user',
          name: name || username
        };
        
        accounts.push(newAccount);
        localStorage.setItem('auth_accounts', JSON.stringify(accounts));
        
        const { password: _, ...userWithoutPassword } = newAccount;
        setUser(userWithoutPassword);
        localStorage.setItem('auth_user', JSON.stringify(userWithoutPassword));
        
        return { success: true };
      }
    } catch (error) {
      console.error('Erreur signup:', error);
      return { success: false, error: error?.message || 'Erreur lors de la création du compte' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const isAdmin = () => user?.role === 'admin';
  const isUser = () => user?.role === 'user';

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    isAdmin,
    isUser,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

