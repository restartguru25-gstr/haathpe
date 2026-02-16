import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Loyalty from "./pages/Loyalty";
import Profile from "./pages/Profile";
import Forum from "./pages/Forum";
import Swap from "./pages/Swap";
import Courses from "./pages/Courses";
import Notifications from "./pages/Notifications";
import CourseDetail from "./pages/CourseDetail";
import Admin from "./pages/Admin";
import Sales from "./pages/Sales";
import POS from "./pages/POS";
import PublicMenu from "./pages/PublicMenu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/loyalty" element={<Loyalty />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/forum" element={<Forum />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/courses/:courseId" element={<CourseDetail />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/pos" element={<POS />} />
              </Route>
              <Route path="/menu/:vendorId" element={<PublicMenu />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
