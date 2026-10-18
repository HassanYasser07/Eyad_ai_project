import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import AccountRequiredRoute from '@/components/AccountRequiredRoute';
import { I18nProvider } from '@/i18n/I18nContext';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import Chat from '@/pages/Chat';
import Intro from '@/pages/Intro';
import IntroGate from '@/components/intro/IntroGate';
import Studios from '@/pages/Studios';
import SearchPage from '@/pages/Search';
import LogoStudio from './pages/LogoStudio';
import VisualIdentityStudio from '@/pages/VisualIdentityStudio';
import AIImagesStudio from '@/pages/AIImagesStudio';
import TemplatesStudio from "@/pages/TemplatesStudio";
import CompanyProfileStudio from "@/pages/CompanyProfileStudio";
import PresentationsStudio from "@/pages/PresentationsStudio";
import VideoStudio from "@/pages/VideoStudio";
import StudioDetail from '@/pages/StudioDetail';
import Projects from '@/pages/Projects';
import Account from '@/pages/Account';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Auth routes (public) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />


      {/* Guest-first app: visitors can explore EYAD without logging in. */}
      <Route path="/intro" element={<Intro />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<IntroGate />} />
        <Route path="/home" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/studios" element={<Studios />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/studios/logo" element={<LogoStudio />} />
        <Route path="/studios/brand-kit" element={<VisualIdentityStudio />} />
        <Route path="/studios/ai-images" element={<AIImagesStudio />} />
        <Route path="/studios/templates" element={<TemplatesStudio />} />
        <Route path="/studios/company-profile" element={<CompanyProfileStudio />} />
        <Route path="/studios/presentations" element={<PresentationsStudio />} />
        <Route path="/studios/video" element={<VideoStudio />} />
        <Route path="/studios/:id" element={<StudioDetail />} />

        {/* Permanent account required only for private user areas. */}
        <Route element={<AccountRequiredRoute />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <I18nProvider>
            <AuthenticatedApp />
          </I18nProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App