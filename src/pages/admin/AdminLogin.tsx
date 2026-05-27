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

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
      return "E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.";
    }

    if (message.includes("failed to fetch") || message.includes("network") || message.includes("fetch")) {
      return "Supabase auth servisine ulaşılamadı. Ağ bağlantısını ve Supabase ayarlarını kontrol edin.";
    }
  }

  return "Giriş sırasında bir auth hatası oluştu. Lütfen tekrar deneyin.";
}

async function logMissingAdminRoleDebug(user: { id: string; email?: string }) {
  if (!import.meta.env.DEV || !supabase) return;

  const { data: matchingRows, error } = await supabase.from("user_roles").select("user_id, role").eq("user_id", user.id);

  console.debug("[admin-login] admin role not found", {
    currentAuthUserId: user.id,
    currentAuthUserEmail: user.email,
    matchingUserRolesRows: matchingRows,
    matchingUserRolesError: error,
  });
}

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

  if (!loading && session && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-elevated">
          <h1 className="font-display text-2xl font-semibold">Yetkisiz Erişim</h1>
          <p className="mt-3 text-sm text-muted-foreground">Bu hesabın Eclipse Mühendislik yönetim paneline erişim yetkisi bulunmuyor.</p>
          <Button
            onClick={async () => {
              await supabase?.auth.signOut();
              navigate(0);
            }}
            className="mt-6 bg-gradient-electric text-white"
          >
            Çıkış Yap
          </Button>
        </div>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      toast({
        title: "Supabase bağlantısı eksik",
        description: "VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY ortam değişkenlerini tanımlayın.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast({
          title: "Giriş başarısız",
          description: getAuthErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const user = data.user;

      if (!user?.id) {
        throw new Error("Supabase Auth did not return a signed-in user.");
      }

      const roleQuery = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const { data: role, error: roleError } = roleQuery;

      if (import.meta.env.DEV) {
        console.debug("[admin-login] signed in user", {
          userId: user.id,
          email: user.email,
        });
        console.debug("[admin-login] admin role query result", roleQuery);
      }

      if (roleError || !role) {
        await logMissingAdminRoleDebug(user);
        await supabase.auth.signOut();
        toast({
          title: "Yetki gerekli",
          description: "Bu hesabın yönetim paneli için admin rolü yok.",
          variant: "destructive",
        });
        return;
      }

      // TODO: Replace temporary admin credentials before production.
      toast({ title: "Giriş yapıldı", description: "Yönetim paneline yönlendiriliyorsunuz." });
      navigate("/admin", { replace: true });
    } catch (error) {
      toast({
        title: "Giriş başarısız",
        description: getAuthErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
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
              <Label htmlFor="email">E-posta veya kullanıcı adı</Label>
              <Input id="email" type="text" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
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
          </form>
        )}
      </div>
    </div>
  );
}
