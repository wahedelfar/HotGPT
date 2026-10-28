import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import { consumeAuthRedirect } from "@/lib/auth";
import "./index.css";

const queryClient = new QueryClient();

// Supabase implicit-flow confirmation links return session tokens in the URL hash.
// Consume them before React starts, then remove the tokens from the address bar.
const receivedAuthSession = consumeAuthRedirect();
if (receivedAuthSession && window.location.pathname === "/auth") {
  window.history.replaceState({}, document.title, "/");
}

// Password-recovery links can land on the site root instead of /auth
// (in practice Supabase sends them to the Site URL). The set-new-password
// form lives on /auth, so move any recovery landing there before React
// starts, keeping the hash intact for Auth.tsx to read.
try {
  const bootHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (bootHash.get("type") === "recovery" && bootHash.get("access_token") && window.location.pathname !== "/auth") {
    window.history.replaceState({}, document.title, "/auth" + window.location.hash);
  }
} catch {}

// Email links that fail verification (expired or already used) return to the
// site root with an error in the URL hash. Send those visitors to the auth
// page with a flag so Auth.tsx can explain what happened instead of silence.
try {
  const errHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (errHash.get("error_code") === "otp_expired" || errHash.get("error") === "access_denied") {
    sessionStorage.setItem("hotgpt-auth-link-notice", "expired");
    window.history.replaceState({}, document.title, "/auth");
  }
} catch {}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
