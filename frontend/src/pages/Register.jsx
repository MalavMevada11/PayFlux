import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { Card, CardHeader, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Layers } from 'lucide-react';

export default function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, true, { first_name: firstName.trim(), last_name: lastName.trim() });
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-lg border-muted">
        <CardHeader className="space-y-4 px-0 pt-0 pb-6 text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">Pay<span className="text-primary">Flux</span></span>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground text-sm">Start managing your invoices in seconds</p>
          </div>
        </CardHeader>
        
        <CardContent className="px-0 pb-0">
          {error && <div className="rounded-md bg-destructive/10 p-4 mb-6 text-sm text-destructive font-medium border border-destructive/20">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="register-firstname">First Name *</Label>
                <Input
                  id="register-firstname"
                  type="text"
                  autoComplete="given-name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-lastname">Last Name</Label>
                <Input
                  id="register-lastname"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">Email address *</Label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password *</Label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <Button id="register-submit" type="submit" className="w-full h-11 text-base mt-2" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="text-muted-foreground text-sm mt-8 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
