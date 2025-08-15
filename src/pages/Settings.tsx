import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Database, Save, RotateCcw } from 'lucide-react';
import Header from '@/components/Header';

interface SettingsProps {
  onLogout: () => void;
}

const Settings = ({ onLogout }: SettingsProps) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load saved settings
    const savedUrl = localStorage.getItem('custom_supabase_url');
    const savedKey = localStorage.getItem('custom_supabase_key');
    
    if (savedUrl) setSupabaseUrl(savedUrl);
    if (savedKey) setSupabaseKey(savedKey);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (supabaseUrl && supabaseKey) {
        // Validate URL format
        try {
          new URL(supabaseUrl);
        } catch {
          throw new Error('Invalid Supabase URL format');
        }

        localStorage.setItem('custom_supabase_url', supabaseUrl);
        localStorage.setItem('custom_supabase_key', supabaseKey);
        
        toast({
          title: "Settings saved",
          description: "Custom Supabase configuration saved. Please refresh the page for changes to take effect.",
        });
      } else {
        throw new Error('Both URL and key are required');
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_key');
    setSupabaseUrl('');
    setSupabaseKey('');
    
    toast({
      title: "Settings reset",
      description: "Reverted to default Supabase configuration. Please refresh the page.",
    });
  };

  const isUsingCustomConfig = Boolean(localStorage.getItem('custom_supabase_url'));

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={onLogout} />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Supabase Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure your own self-hosted Supabase instance. Leave empty to use the default configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supabase-key">Supabase Anon Key</Label>
              <Input
                id="supabase-key"
                type="password"
                placeholder="Your Supabase anon key"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSave} 
                disabled={isSaving || (!supabaseUrl && !supabaseKey)}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
              
              {isUsingCustomConfig && (
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Default
                </Button>
              )}
            </div>

            {isUsingCustomConfig && (
              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-primary font-medium">
                  ✓ Using custom Supabase configuration
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;