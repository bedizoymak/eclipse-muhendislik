import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

// Phase 13.6: single shared Not Found screen for both the demo app and
// the marketing site. It never derives any business text/explanation
// from the user-entered path (only logs the raw pathname to the console
// for diagnostics) and never runs a Supabase query. The home link is a
// fixed, hardcoded "/" -- resolved by the app's own root route (DemoHome
// in demo mode, AutoHome/marketing home otherwise) -- never a guessed
// 1:1 redirect target derived from the invalid path itself.
const isDemoApp = import.meta.env.MODE === "demo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-deep px-6 text-center text-white">
      <div>
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-white/70">Sayfa bulunamadı</p>
        <Link to="/" className="text-electric-bright underline hover:text-electric-bright/90">
          {isDemoApp ? "Demo ana sayfasına dön" : "Ana sayfaya dön"}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
