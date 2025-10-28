import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

// Comptes par défaut
const DEFAULT_ACCOUNTS = [
  {
    id: 'admin1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Administrateur'
  },
  {
    id: 'user1',
    username: 'user',
    password: 'user123',
    role: 'user',
    name: 'Utilisateur'
  }
];

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

  const login = (username, password) => {
    // Load accounts from localStorage or use defaults
    let accounts = JSON.parse(localStorage.getItem('auth_accounts')) || DEFAULT_ACCOUNTS;
    
    // Find user
    const foundUser = accounts.find(
      acc => acc.username === username && acc.password === password
    );

    if (foundUser) {
      // Don't save password in user state
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('auth_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    }

    return { success: false, error: 'Nom d\'utilisateur ou mot de passe incorrect' };
  };

  const signup = async ({ username, password, nom, role = 'user' }) => {
    try {
      // Load existing accounts
      let accounts = JSON.parse(localStorage.getItem('auth_accounts')) || DEFAULT_ACCOUNTS;
      
      // Check if username already exists
      if (accounts.find(acc => acc.username === username)) {
        return { success: false, error: 'Ce nom d\'utilisateur existe déjà' };
      }
      
      // Create new account
      const newAccount = {
        id: `user_${Date.now()}`,
        username,
        password,
        role, // Always 'user' for new signups
        name: nom
      };
      
      // Add to accounts
      accounts.push(newAccount);
      localStorage.setItem('auth_accounts', JSON.stringify(accounts));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erreur lors de la création du compte' };
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

