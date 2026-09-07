import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import logoDark from "@/assets/logo-dark-bg.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export default function AdminLogin() {
  const { session, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  if (!loading && session && isAdmin) {
    return <Navigate to={(location.state as { from?: string } | null)?.from || "/admin"} replace />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      toast({
        title: "Giriş başarısız",
        description: "E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.",
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Giriş yapıldı", description: "Yönetim paneline yönlendiriliyorsunuz." });
    navigate("/admin", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <img src={logoDark} alt="Eclipse Mühendislik" className="mx-auto h-auto w-48 select-none" />
          <h1 className="mt-6 font-display text-2xl font-semibold">Eclipse Mühendislik Yönetim Paneli</h1>
          <p className="mt-2 text-sm text-white/65">Devam etmek için yönetici hesabınızla giriş yapın.</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">Supabase bağlantısı eksik</div>
                <p className="mt-1 leading-relaxed">
                  Admin panelini kullanmak için `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` ortam değişkenleri tanımlanmalıdır.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-elevated">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gradient-electric text-white shadow-glow hover:shadow-elevated">
              {busy ? "Giriş yapılıyor..." : "Panele giriş yap"}
            </Button>
            <div className="text-center text-sm font-semibold text-foreground">Giriş Yap</div>
          </form>
        )}
      </div>
    </div>
  );
}
