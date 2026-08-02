/**
 * Inscription — présentation uniquement.
 * AuthContext, signup(), rôles, ADMIN_PASSWORD et validations inchangés.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import cosmosLogo from '../assets/cosmos-logo.svg';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  User,
  ArrowLeft,
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
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

  const stepDescription =
    step === 1
      ? 'Créez votre compte'
      : step === 2
        ? `Créer un compte ${selectedRole === 'admin' ? 'Administrateur' : 'Utilisateur'}`
        : 'Vérification administrateur';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm">
            <img src={cosmosLogo} alt="" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            COSMOS ALGÉRIE
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{stepDescription}</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm sm:p-7">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Type de compte</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sélectionnez le type de compte que vous souhaitez créer.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleRoleSelect('user')}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border border-border/80 bg-background px-3.5 py-3.5 text-left transition-colors',
                    'hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Utilisateur</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Peut ajouter des données mais ne peut pas supprimer
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect('admin')}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border border-border/80 bg-background px-3.5 py-3.5 text-left transition-colors',
                    'hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Administrateur</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Accès complet à toutes les fonctionnalités
                    </p>
                  </div>
                </button>
              </div>

              <Button type="button" variant="ghost" onClick={onCancel} className="h-10 w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Annuler
              </Button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">Nouveau compte</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Renseignez les informations du compte{' '}
                  {selectedRole === 'admin' ? 'administrateur' : 'utilisateur'}.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-lg border border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.08)] px-3 py-2.5 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                  Nom complet
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Entrez votre nom complet"
                  required
                  className="h-10"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                  Nom d&apos;utilisateur
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Choisissez un nom d&apos;utilisateur"
                  required
                  className="h-10"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Au moins 6 caractères"
                    required
                    minLength={6}
                    className="h-10 pr-10"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground">
                  Confirmer le mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Répétez le mot de passe"
                    required
                    className="h-10 pr-10"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={
                      showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'
                    }
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création…
                  </>
                ) : (
                  'Créer le compte'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="h-10 w-full"
                disabled={loading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Vérification administrateur
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pour créer un compte administrateur, saisissez le mot de passe administrateur.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-lg border border-[hsl(var(--danger)/0.45)] bg-[hsl(var(--danger)/0.08)] px-3 py-2.5 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword" className="text-xs font-medium text-muted-foreground">
                  Mot de passe administrateur
                </Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Mot de passe administrateur"
                    required
                    className="h-10 pr-10"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={
                      showAdminPassword
                        ? 'Masquer le mot de passe administrateur'
                        : 'Afficher le mot de passe administrateur'
                    }
                    tabIndex={-1}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="h-10 w-full">
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
                className="h-10 w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          AutoGet · Cosmos Algérie
        </p>
      </div>
    </div>
  );
};

export default Signup;
