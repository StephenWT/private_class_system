import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/api';
import { LogOut, BookOpen, Settings, FileText, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
// OPTIONAL: show email
import { supabase } from '@/integrations/supabase/client';

interface HeaderProps {
  onLogout: () => void;
}

const Header = ({ onLogout }: HeaderProps) => {
  const location = useLocation();
  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

  // OPTIONAL: show the logged-in email
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data?.user?.email ?? null);
    });
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      await auth.logout();  // ensure Supabase session is cleared
    } finally {
      onLogout();           // then bounce your app state/router
    }
  };

  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Class Attendance Manager</h1>
            <div className="flex items-center gap-2">
              {isDemo && (
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded">
                  Demo Mode
                </span>
              )}
              {email && (
                <span className="text-xs text-muted-foreground">
                  {email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            <Button
              variant={location.pathname === '/' ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendance
              </Link>
            </Button>

            <Button
              variant={location.pathname === '/invoices' ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/invoices" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Invoices
              </Link>
            </Button>

            <Button
              variant={location.pathname === '/settings' ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </Button>
          </nav>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2 ml-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
