import { Link } from "react-router-dom";

// Phase 13.6/13.7: single shared Not Found screen for both the demo app and
// the marketing site. It never derives any business text/explanation
// from the user-entered path and never runs a Supabase query. The home link
// is a fixed, hardcoded "/" -- resolved by the app's own root route (DemoHome
// in demo mode, AutoHome/marketing home otherwise) -- never a guessed
// 1:1 redirect target derived from the invalid path itself.
//
// Phase 13.7: reaching this page on an unknown route is an EXPECTED user
// navigation outcome, not an application error -- it must never call
// console.error/console.warn. If route-not-found telemetry is ever needed,
// that requires a separate, safely-designed task (e.g. batched, sampled,
// server-side logging) -- not a client console log on every render.
const isDemoApp = import.meta.env.MODE === "demo";

const NotFound = () => {
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
