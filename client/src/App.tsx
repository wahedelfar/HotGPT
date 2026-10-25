import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LanguageProvider } from "./contexts/LanguageContext";
import AuthPage from "./pages/Auth";
import BillingPage from "./pages/Billing";
import AdminBillingPage from "./pages/AdminBilling";
import LuckyPage from "./pages/Lucky";
import ProfilePage from "./pages/Profile";
import AdminLuckyPage from "./pages/AdminLucky";
import LuckyTermsPage from "./pages/LuckyTerms";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chat/:id" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/rewards" component={LuckyPage} />
      <Route path="/hotlucky" component={LuckyPage} />
      <Route path="/lucky.php" component={LuckyPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/lucky-terms" component={LuckyTermsPage} />
      <Route path="/admin/lucky.php" component={AdminLuckyPage} />
      <Route path="/admin" component={AdminBillingPage} />
      <Route path="/admin/login" component={AdminBillingPage} />
      <Route path="/admin/billing" component={AdminBillingPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="dark" switchable>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
