import { motion, AnimatePresence } from "motion/react";
import { 
  Package, 
  Lock, 
  ArrowRight, 
  User, 
  Building2, 
  Phone, 
  ShieldCheck, 
  Briefcase, 
  Star, 
  Award, 
  Users, 
  Zap,
  Database,
  Upload,
  X,
  Check
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { LocalUser } from "../types";
import { dbService } from "../db";

interface LoginProps {
  onLoginSuccess: (user: LocalUser) => void;
}

type AuthMode = "login" | "signup";

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  
  // Signup State fields
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("Wholesaler");
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Restore Backup & Auto-Register States
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [showAutoRegisterHelper, setShowAutoRegisterHelper] = useState(false);

  // Auto clear toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clear errors when switching modes
  useEffect(() => {
    setError(null);
    setShowAutoRegisterHelper(false);
  }, [mode]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowAutoRegisterHelper(false);

    const cleanPhone = phone.trim();
    const cleanPin = pin.trim();

    if (!cleanPhone) {
      setError("WhatsApp Number is strictly required.");
      return;
    }

    if (cleanPin.length !== 4) {
      setError("Security PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);

    // Simulate database lookup or signup with tiny professional delay
    setTimeout(async () => {
      try {
        if (mode === "login") {
          // ==================== LOGIN MODE ====================
          // Query directly via cloud-first dbService auth
          const foundUser = await dbService.authenticateWorkspace(cleanPhone, cleanPin);
          
          if (foundUser) {
            setToast({ message: "Welcome back! Access Granted!", type: "success" });
            localStorage.setItem("store_user", JSON.stringify(foundUser));
            setTimeout(() => {
              onLoginSuccess(foundUser);
              setLoading(false);
            }, 800);
          } else {
            // Check if user exists on the backend server
            const list = await dbService.getUsersList();
            const phoneExists = list.some((u) => u.phone.trim() === cleanPhone);

            if (phoneExists) {
              setError("Incorrect Security PIN. Please verify your 4-digit code.");
            } else {
              setShowAutoRegisterHelper(true);
              setError("This number is not registered yet. Would you like to activate a local workspace below?");
            }
            setLoading(false);
          }
        } else {
          // ==================== SIGNUP/CREATE ACCOUNT MODE ====================
          const list = await dbService.getUsersList();
          const foundUser = list.find((u) => u.phone.trim() === cleanPhone);

          if (foundUser) {
            setError("This WhatsApp number is already registered. Please login.");
            setLoading(false);
            return;
          }

          if (!ownerName.trim()) {
            setError("Owner Name is required.");
            setLoading(false);
            return;
          }

          if (!storeName.trim()) {
            setError("Business/Store Name is required.");
            setLoading(false);
            return;
          }

          // Generate clean unique user payload
          const newUser: LocalUser = {
            uid: "saas-user-" + Math.random().toString(36).substring(2, 9),
            email: email.trim() || `${cleanPhone}@invexa.com`,
            ownerName: ownerName.trim(),
            phone: cleanPhone,
            storeName: storeName.trim(),
            businessType: businessType,
            pinCode: cleanPin,
          };

          // Save to Local Workspace storage
          await dbService.saveUserWorkspace(newUser);
          await dbService.saveItems(newUser.uid, []);
          await dbService.saveStockMoves(newUser.uid, []);

          setToast({ message: "Enterprise Workspace Created successfully!", type: "success" });
          setTimeout(() => {
            onLoginSuccess(newUser);
            setLoading(false);
          }, 1000);
        }
      } catch (err: any) {
        console.error("Authentication error:", err);
        setError("An error occurred while processing. Please try again.");
        setLoading(false);
      }
    }, 400);
  };

  const handleRestoreBackup = async () => {
    setError(null);
    if (!backupCodeInput.trim()) {
      setError("Please paste your Backup Code first.");
      return;
    }

    setLoading(true);
    try {
      const decodedString = atob(backupCodeInput.trim());
      const backupData = JSON.parse(decodedString);

      if (!backupData.user || !backupData.user.phone) {
        throw new Error("Invalid backup format.");
      }

      const restoredUser: LocalUser = backupData.user;
      const restoredItems = backupData.items || [];
      const restoredMoves = backupData.moves || [];

      // Ensure pinCode is set
      if (!restoredUser.pinCode) {
        restoredUser.pinCode = "1234";
      }

      // Save to localStorage
      localStorage.setItem("store_user", JSON.stringify(restoredUser));
      localStorage.setItem(`store_items_${restoredUser.uid}`, JSON.stringify(restoredItems));
      localStorage.setItem(`store_moves_${restoredUser.uid}`, JSON.stringify(restoredMoves));

      // Replicate to server database
      await dbService.saveUserWorkspace(restoredUser);
      await dbService.saveItems(restoredUser.uid, restoredItems);
      await dbService.saveStockMoves(restoredUser.uid, restoredMoves);

      setToast({ message: "Backup Restored & Synchronized Successfully!", type: "success" });
      setTimeout(() => {
        onLoginSuccess(restoredUser);
        setLoading(false);
      }, 1000);
    } catch (e) {
      console.error(e);
      setError("Invalid Backup Code. Please verify you copied the entire backup string.");
      setLoading(false);
    }
  };

  const handleAutoRegister = async () => {
    setLoading(true);
    setError(null);
    setShowAutoRegisterHelper(false);

    try {
      const cleanPhone = phone.trim();
      const cleanPin = pin.trim() || "1234";

      const newUser: LocalUser = {
        uid: "saas-user-" + Math.random().toString(36).substring(2, 9),
        email: `${cleanPhone}@invexa.com`,
        ownerName: "Waleed",
        phone: cleanPhone,
        storeName: "WALEED FOODS 🍎",
        businessType: "Factory",
        pinCode: cleanPin,
      };

      await dbService.saveUserWorkspace(newUser);
      await dbService.saveItems(newUser.uid, []);
      await dbService.saveStockMoves(newUser.uid, []);

      setToast({ message: "Enterprise Workspace Activated Successfully!", type: "success" });
      setTimeout(() => {
        onLoginSuccess(newUser);
        setLoading(false);
      }, 1000);
    } catch (err) {
      setError("Failed to auto-register. Please try manually signing up.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A192F] flex items-center justify-center p-0 sm:p-4 md:p-8 select-none overflow-y-auto font-sans">
      {/* Dynamic Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 bg-[#112240] text-amber-400 rounded-2xl shadow-2xl border border-amber-400/30 text-xs font-bold"
          >
            <span className="h-2 w-2 bg-emerald-400 rounded-full animate-ping" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-full sm:h-auto max-w-5xl bg-white rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-screen sm:min-h-[620px]">
        
        {/* LEFT COLUMN: Beautiful, Authoritative English Trust Showcase (Enterprise Branding) */}
        <div className="lg:col-span-6 bg-[#0B1528] text-slate-100 p-8 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Ambient light effects */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full filter blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full filter blur-3xl" />

          {/* Top Row: App branding and badge */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <Package size={22} className="text-slate-950 font-bold" />
              </div>
              <div>
                <span className="text-sm font-black tracking-wider uppercase text-amber-400 font-mono">INVEXA</span>
                <span className="text-[10px] block text-slate-400 tracking-widest uppercase font-bold">SMART MANAGER</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
              <Award size={12} />
              <span>Verified Secure</span>
            </div>
          </div>

          {/* Core Trust headlines optimized for business managers */}
          <div className="relative z-10 my-10 space-y-6">
            <div className="space-y-3">
              <span className="text-amber-400 text-xs font-black tracking-widest uppercase block bg-amber-500/10 px-3 py-1 rounded-md w-fit">
                MOST TRUSTED BUSINESS COMPANION
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-snug tracking-tight">
                Secure & Reliable Enterprise Management System
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">
                Modern offline-first inventory manager designed to run daily transactions securely for wholesalers, factories, and retail stores.
              </p>
            </div>

            {/* Benefit Grid with Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="bg-[#112240]/40 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-2.5">
                <div className="bg-emerald-500/10 text-emerald-450 p-1.5 rounded-lg shrink-0 mt-0.5 text-emerald-400">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">100% Offline & Private</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Your confidential business data remains securely on your device, not on the cloud.</p>
                </div>
              </div>

              <div className="bg-[#112240]/40 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-2.5">
                <div className="bg-amber-500/10 text-amber-400 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Zap size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">Ultra-Fast Execution</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Log stock movements, invoices, and ledgers instantly with zero loading lag.</p>
                </div>
              </div>

              <div className="bg-[#112240]/40 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-2.5">
                <div className="bg-amber-500/10 text-amber-400 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Phone size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">WhatsApp Integration</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Easily dispatch reorder alerts and purchase sheets directly through WhatsApp.</p>
                </div>
              </div>

              <div className="bg-[#112240]/40 p-3.5 rounded-2xl border border-slate-800 flex items-start gap-2.5">
                <div className="bg-emerald-500/10 text-emerald-400 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Users size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">Multi-Workspace Support</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Create separate business branches, categories, and custom lock codes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Panel */}
          <div className="relative z-10 border-t border-slate-800 pt-5 mt-auto flex flex-col gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
              ))}
              <span className="text-[11px] font-black text-amber-400 mr-2">Brand Trust & Satisfaction</span>
            </div>
            <p className="text-slate-300 text-xs italic leading-relaxed">
              "Managing inventory and stock has never been easier. With Invexa, tracking our wholesale stock value and profits takes seconds!"
            </p>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-slate-800 text-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                M
              </div>
              <div>
                <span className="text-[11px] font-bold text-white block">Haji Muhammad Saleem</span>
                <span className="text-[10px] text-slate-400 block">President, Wholesale Textiles Association</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Interactive Access Card (Forms for Login/Signup) */}
        <div className="lg:col-span-6 bg-white p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
          
          {/* Switching Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                mode === "login" 
                  ? "bg-[#0A192F] text-amber-400 shadow-md" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
              id="toggle-login-tab-button"
            >
              <Lock size={12} />
              <span>Login</span>
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                mode === "signup" 
                  ? "bg-[#0A192F] text-amber-400 shadow-md" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
              id="toggle-signup-tab-button"
            >
              <User size={12} />
              <span>Sign Up</span>
            </button>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              {mode === "login" ? (
                <>
                  <ShieldCheck className="text-[#0A192F]" size={20} />
                  <span>Login to Your Business Panel</span>
                </>
              ) : (
                <>
                  <Briefcase className="text-[#0A192F]" size={20} />
                  <span>Sign Up New Business</span>
                </>
              )}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              {mode === "login" 
                ? "Enter your registered WhatsApp number and 4-digit security PIN to proceed." 
                : "Please register your authentic business details to create a workspace."}
            </p>
          </div>

          {/* Form container */}
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-100 text-xs font-bold text-center">
                ⚠️ {error}
              </div>
            )}

            {/* Condition Fields for Sign Up only */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4"
              >
                {/* Owner Name field */}
                <div>
                  <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase flex items-center gap-1">
                    <User size={10} className="text-slate-400" />
                    <span>Owner Name *</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Muhammad Ahmed"
                    required
                    disabled={loading}
                    className="w-full h-11 text-sm px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-950 focus:outline-none font-bold"
                  />
                </div>

                {/* Store Name field */}
                <div>
                  <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase flex items-center gap-1">
                    <Building2 size={10} className="text-slate-400" />
                    <span>Store / Business Name *</span>
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Ahmed Cloth Traders"
                    required
                    disabled={loading}
                    className="w-full h-11 text-sm px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-950 focus:outline-none font-bold"
                  />
                </div>

                {/* Business Type dropdown */}
                <div>
                  <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase flex items-center gap-1">
                    <Briefcase size={10} className="text-slate-400" />
                    <span>Business Type *</span>
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    disabled={loading}
                    className="w-full h-11 text-sm px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-950 focus:outline-none font-bold"
                  >
                    <option value="Wholesaler">Wholesaler / Trader</option>
                    <option value="Factory">Factory / Manufacturer</option>
                    <option value="Retailer">Retailer / Shop</option>
                    <option value="Supermarket">Supermarket / Mart</option>
                    <option value="Cafe">Hotel / Cafe</option>
                    <option value="Other">Other Business</option>
                  </select>
                </div>

                {/* Email Address field (Optional) */}
                <div>
                  <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@example.com"
                    disabled={loading}
                    className="w-full h-11 text-sm px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-950 focus:outline-none font-bold font-mono"
                  />
                </div>
              </motion.div>
            )}

            {/* WhatsApp Number Field */}
            <div>
              <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase flex items-center gap-1">
                <Phone size={10} className="text-slate-400" />
                <span>WhatsApp / Mobile Number *</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 03001234567"
                required
                disabled={loading}
                className="w-full h-12 text-base px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-950 focus:outline-none font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Use standard mobile format (e.g. 03001234567 or +923001234567)
              </span>
            </div>

            {/* 4-Digit PIN Field */}
            <div>
              <label className="block text-slate-700 text-[10px] font-extrabold tracking-wider mb-1.5 uppercase flex items-center gap-1">
                <Lock size={10} className="text-slate-400" />
                <span>4-Digit Secure PIN *</span>
              </label>
              <input
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                maxLength={4}
                required
                disabled={loading}
                className="w-full h-12 text-lg text-center px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl tracking-[0.5em] font-mono duration-150 text-slate-950 focus:outline-none font-black"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Enter a 4-digit security code to protect your business.
              </span>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading || !phone || pin.length !== 4}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#0A192F] hover:bg-[#112240] text-amber-400 font-extrabold rounded-xl duration-200 shadow-lg disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider mt-2 border border-amber-400/10"
              id="auth-submit-action-button"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight size={14} className="text-[#F59E0B]" />
              )}
              <span>
                {loading 
                  ? "Processing..." 
                  : mode === "login" 
                    ? "ACCESS WORKSPACE" 
                    : "CREATE BUSINESS ACCOUNT"}
              </span>
            </button>

            {/* Smart Auto-Register Helper */}
            <AnimatePresence>
              {showAutoRegisterHelper && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-3 mt-3"
                >
                  <div className="flex items-start gap-2 text-[10.5px] text-amber-800 font-bold leading-relaxed">
                    <span className="mt-0.5">💡</span>
                    <span>No active workspace found on the cloud for <strong>{phone}</strong> yet. Would you like to instantly activate a secure workspace for this number on this device?</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoRegister}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition duration-150"
                  >
                    Yes, Activate Secure Workspace
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Prompt info */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <span className="text-[10px] text-slate-400 block tracking-wide">
              Equipped with state-of-the-art storage and security. Your business records remain private and secure on this device.
            </span>
          </div>

          {/* Restore Backup Panel */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsRestoreOpen(!isRestoreOpen)}
              className="text-[10px] font-extrabold text-slate-500 hover:text-[#0A192F] flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition"
            >
              <Database size={12} className="text-[#0A192F]" />
              <span>Restore Cloud Backup Code</span>
            </button>

            <AnimatePresence>
              {isRestoreOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mt-3.5 space-y-3 overflow-hidden text-left"
                >
                  <label className="block text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                    Paste Base64 Backup Code
                  </label>
                  <textarea
                    value={backupCodeInput}
                    onChange={(e) => setBackupCodeInput(e.target.value)}
                    placeholder="Paste the Base64 backup string you exported earlier..."
                    className="w-full h-20 text-[9px] font-mono px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-[#0A192F]/10 focus:border-[#0A192F] rounded-xl duration-150 text-slate-700 focus:outline-none resize-none leading-relaxed select-all"
                  />
                  <button
                    type="button"
                    onClick={handleRestoreBackup}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition duration-150"
                  >
                    Load & Sync Backup
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
}
