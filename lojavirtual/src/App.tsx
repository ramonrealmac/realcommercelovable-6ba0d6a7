import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import Login from "@/pages/auth/Login";
import AdminLayout from "@/layouts/AdminLayout";
import LojaIndex from "@/pages/loja/LojaIndex";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const themeLoaded = useThemeColors();
  if (!themeLoaded) {
    return <div className="min-h-screen bg-background" />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<AdminLayout />} />
      <Route path="/loja" element={<LojaIndex />} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
