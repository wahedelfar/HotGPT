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

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
