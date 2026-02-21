import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { PaymentNotificationProvider } from "@/contexts/PaymentNotificationContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";

// Lazy-load other pages; Landing is eager so first visit never hits "Failed to fetch dynamically imported module"
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Cart = lazy(() => import("./pages/Cart"));
const Orders = lazy(() => import("./pages/Orders"));
const Loyalty = lazy(() => import("./pages/Loyalty"));
const Profile = lazy(() => import("./pages/Profile"));
const Forum = lazy(() => import("./pages/Forum"));
const Swap = lazy(() => import("./pages/Swap"));
const Courses = lazy(() => import("./pages/Courses"));
const Notifications = lazy(() => import("./pages/Notifications"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Sales = lazy(() => import("./pages/Sales"));
const POS = lazy(() => import("./pages/POS"));
const VendorEntry = lazy(() => import("./pages/VendorEntry"));
const PublicMenu = lazy(() => import("./pages/PublicMenu"));
const PayDirect = lazy(() => import("./pages/PayDirect"));
const CustomerLogin = lazy(() => import("./pages/CustomerLogin"));
const CustomerOrders = lazy(() => import("./pages/CustomerOrders"));
const CustomerWallet = lazy(() => import("./pages/CustomerWallet"));
const CustomerTransactions = lazy(() => import("./pages/CustomerTransactions"));
const CustomerRedemption = lazy(() => import("./pages/CustomerRedemption"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const Search = lazy(() => import("./pages/Search"));
const OndcExport = lazy(() => import("./pages/OndcExport"));
const MenuLanding = lazy(() => import("./pages/MenuLanding"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Shown while a lazy route chunk is loading — keeps UX responsive */
function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-4" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CustomerAuthProvider>
        <AppProvider>
          <PaymentNotificationProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
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
                <Route path="/vendor/ondc-export" element={<OndcExport />} />
              </Route>
              <Route path="/search" element={<Search />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/menu" element={<MenuLanding />} />
              <Route path="/menu/:vendorId" element={<VendorEntry />} />
              <Route path="/menu/:vendorId/browse" element={<PublicMenu />} />
              <Route path="/menu/:vendorId/pay" element={<PayDirect />} />
              <Route path="/order/:orderId" element={<OrderTracking />} />
              <Route path="/payment/return" element={<PaymentReturn />} />
              <Route path="/customer-login" element={<CustomerLogin />} />
              <Route path="/customer/orders" element={<CustomerOrders />} />
              <Route path="/customer/wallet" element={<CustomerWallet />} />
              <Route path="/customer/transactions" element={<CustomerTransactions />} />
              <Route path="/customer/redemption" element={<CustomerRedemption />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
          </PaymentNotificationProvider>
        </AppProvider>
        </CustomerAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
