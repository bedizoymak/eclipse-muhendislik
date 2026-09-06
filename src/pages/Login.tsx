import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

const getReturnPath = (search: string) => {
  const value = new URLSearchParams(search).get("redirectTo");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
};

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnPath = getReturnPath(location.search);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate(returnPath, { replace: true });
    });
  }, [navigate, returnPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setError(null);
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (signInError) {
      setError("E-posta adresi veya şifre hatalı. Lütfen tekrar deneyin.");
      return;
    }

    navigate(returnPath, { replace: true });
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-navy text-white lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid-pattern absolute inset-0 opacity-50" />
      <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-electric/20 blur-3xl" />
      <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
        <Link to="/" aria-label="Eclipse Mühendislik ana sayfa" className="w-fit">
          <Logo light />
        </Link>
        <div className="max-w-xl py-20 lg:py-0">
          <p className="eyebrow text-electric-bright">Eclipse Portal</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Çalışma alanınıza güvenle erişin.</h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">Operasyonlarınızı ve verilerinizi tek, güvenli bir noktadan yönetin.</p>
        </div>
        <p className="text-sm text-white/45">© {new Date().getFullYear()} Eclipse Mühendislik</p>
      </section>

      <section className="relative flex items-center bg-white px-6 py-12 text-foreground sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-electric-soft text-electric">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-semibold">Giriş yapın</h2>
          <p className="mt-2 text-muted-foreground">Devam etmek için hesap bilgilerinizi girin.</p>

          {!isSupabaseConfigured ? (
            <div className="mt-8 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              Giriş henüz yapılandırılmamış. Lütfen sistem yöneticinizle iletişime geçin.
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta adresi</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="email" type="email" autoComplete="email" className="h-12 pl-10" placeholder="ornek@firma.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Şifre</Label>
                  <span className="text-xs text-muted-foreground">Hesabınız kurum tarafından yönetilir.</span>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 px-10" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="h-12 w-full bg-electric text-white hover:bg-electric/90" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
              </Button>
            </form>
          )}
          <Link to="/" className="mt-8 inline-block text-sm font-medium text-electric transition-colors hover:text-navy">← Ana sayfaya dön</Link>
        </div>
      </section>
    </main>
  );
};

export default Login;
