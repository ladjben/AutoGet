/**
 * Connexion — présentation uniquement.
 * AuthContext, login(), rôles et redirections inchangés.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Signup from './Signup';
import cosmosLogo from '../assets/cosmos-logo.svg';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (!result.success) {
        setError(result.error);
      }
      // Si succès, le contexte AuthContext redirigera automatiquement
    } catch (err) {
      console.error('Erreur login:', err);
      setError('Une erreur est survenue lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  // Show signup if requested
  if (showSignup) {
    return <Signup onCancel={() => setShowSignup(false)} />;
  }

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

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-card shadow-sm">
            <img src={cosmosLogo} alt="" className="h-9 w-9 object-contain" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            COSMOS ALGÉRIE
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Espace de gestion — stock, fournisseurs, opérations et réception.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm sm:p-7">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">Connexion</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Identifiez-vous pour accéder à votre espace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                Nom d&apos;utilisateur
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant"
                autoComplete="username"
                required
                className="h-10"
                disabled={loading}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  required
                  className="h-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground',
                    'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  )}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-border/80 pt-5 text-center">
            <p className="mb-2.5 text-xs text-muted-foreground">Vous n&apos;avez pas de compte ?</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSignup(true)}
              className="h-10 w-full"
              disabled={loading}
            >
              Créer un nouveau compte
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          AutoGet · Cosmos Algérie
        </p>
      </div>
    </div>
  );
};

export default Login;
