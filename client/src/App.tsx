import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import BrowseJobs from "@/pages/jobs/browse";
import PostJob from "@/pages/jobs/post";
import JobDetail from "@/pages/jobs/detail";
import ProviderDashboard from "@/pages/provider/dashboard";
import Messages from "@/pages/messages/index";
import Chat from "@/pages/messages/chat";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <Component {...rest} /> : <Redirect to="/login" />;
}

function PublicRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  
  return !isAuthenticated ? <Component {...rest} /> : <Redirect to="/jobs" />;
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">
        <Switch>
          <Route path="/" component={isAuthenticated ? BrowseJobs : Landing} />
          <Route path="/login">
            {() => <PublicRoute component={Login} />}
          </Route>
          <Route path="/signup">
            {() => <PublicRoute component={Signup} />}
          </Route>
          <Route path="/jobs" component={BrowseJobs} />
          <Route path="/jobs/:id" component={JobDetail} />
          <Route path="/post-job">
            {() => <ProtectedRoute component={PostJob} />}
          </Route>
          <Route path="/dashboard">
            {() => <ProtectedRoute component={ProviderDashboard} />}
          </Route>
          <Route path="/messages">
            {() => <ProtectedRoute component={Messages} />}
          </Route>
          <Route path="/messages/:jobId">
            {() => <ProtectedRoute component={Chat} />}
          </Route>
          <Route path="/profile">
            {() => <ProtectedRoute component={Profile} />}
          </Route>
          <Route path="/my-jobs">
            {() => <ProtectedRoute component={BrowseJobs} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
