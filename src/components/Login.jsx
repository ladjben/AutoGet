import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Signup from './Signup';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = login(username, password);
    
    setLoading(false);
    
    if (!result.success) {
      setError(result.error);
    }
    // Si succès, le contexte AuthContext redirigera automatiquement
  };

  // Show signup if requested
  if (showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Signup onCancel={() => setShowSignup(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            👟 Gestion Chaussures
          </h1>
          <p className="text-gray-600">Connectez-vous pour continuer</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Entrez votre nom d'utilisateur"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Entrez votre mot de passe"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Demo Accounts */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center mb-4">
            Comptes de démonstration:
          </p>
          <div className="space-y-2 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="font-semibold text-gray-700">👨‍💼 Administrateur</div>
              <div className="text-gray-600">Nom: admin | Pass: admin123</div>
              <div className="text-xs text-gray-500 mt-1">Peut tout faire</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="font-semibold text-gray-700">👤 Utilisateur</div>
              <div className="text-gray-600">Nom: user | Pass: user123</div>
              <div className="text-xs text-gray-500 mt-1">Peut ajouter uniquement</div>
            </div>
          </div>
        </div>

        {/* Signup Button */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Vous n'avez pas de compte ?
          </p>
          <button
            type="button"
            onClick={() => setShowSignup(true)}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Créer un nouveau compte
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;

