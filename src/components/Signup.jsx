import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ADMIN_PASSWORD = 'albator';

const Signup = ({ onCancel }) => {
  const [step, setStep] = useState(1); // 1: choose role, 2: create account, 3: verify admin
  const [selectedRole, setSelectedRole] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    
    if (role === 'admin') {
      setStep(3); // Go to admin password verification
    } else {
      setStep(2); // Go to signup form
    }
  };

  const handleAdminPasswordSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (adminPassword !== ADMIN_PASSWORD) {
      setError('Mot de passe administrateur incorrect');
      return;
    }
    
    setStep(2); // Proceed to signup form
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation des champs requis
    if (!formData.name || !formData.name.trim()) {
      setError('Le nom complet est requis');
      return;
    }

    if (!formData.username || !formData.username.trim()) {
      setError('Le nom d\'utilisateur est requis');
      return;
    }

    if (!formData.password || !formData.password.trim()) {
      setError('Le mot de passe est requis');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!selectedRole) {
      setError('Veuillez sélectionner un type de compte');
      return;
    }

    setLoading(true);

    try {
      const result = await signup({
        name: formData.name.trim(),
        username: formData.username.trim(),
        password: formData.password,
        role: selectedRole || 'user',
      });

      if (result && !result.success) {
        setError(result.error || 'Erreur lors de la création du compte');
        setLoading(false);
      } else if (result && result.success) {
        // Succès - le contexte AuthContext redirigera automatiquement
        // On peut aussi appeler onCancel pour fermer le formulaire
        setTimeout(() => {
          onCancel?.();
        }, 500);
      }
    } catch (err) {
      console.error('Erreur signup:', err);
      setError(err?.message || 'Une erreur est survenue lors de la création du compte');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">
            COSMOS ALGÉRIE
          </CardTitle>
          <CardDescription className="text-center">
            {step === 1 && "Créez votre compte"}
            {step === 2 && `Créer un compte ${selectedRole === 'admin' ? 'Administrateur' : 'Utilisateur'}`}
            {step === 3 && "Vérification administrateur"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Sélectionnez le type de compte que vous souhaitez créer :
              </p>
              
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto py-6 flex flex-col items-start"
                  onClick={() => handleRoleSelect('user')}
                >
                  <div className="font-semibold text-lg mb-1">👤 Utilisateur</div>
                  <div className="text-sm text-muted-foreground text-left">
                    Peut ajouter des données mais ne peut pas supprimer
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto py-6 flex flex-col items-start"
                  onClick={() => handleRoleSelect('admin')}
                >
                  <div className="font-semibold text-lg mb-1">👨‍💼 Administrateur</div>
                  <div className="text-sm text-muted-foreground text-left">
                    Accès complet à toutes les fonctionnalités
                  </div>
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="w-full"
              >
                Annuler
              </Button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Entrez votre nom complet"
                  required
                />
              </div>

              {/* Username Input */}
              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Choisissez un nom d'utilisateur"
                  required
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Au moins 6 caractères"
                  required
                  minLength={6}
                />
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Répétez le mot de passe"
                  required
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Création...' : 'Créer le compte'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="w-full"
              >
                Retour
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
              <Alert>
                <AlertDescription>
                  Pour créer un compte administrateur, veuillez saisir le mot de passe administrateur.
                </AlertDescription>
              </Alert>

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Admin Password Input */}
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Mot de passe administrateur</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Entrez le mot de passe administrateur"
                  required
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
              >
                Continuer
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(1);
                  setAdminPassword('');
                  setError('');
                }}
                className="w-full"
              >
                Retour
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
