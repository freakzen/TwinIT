"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  ArrowRight,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";
type Theme = "light" | "dark";

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("twinit-theme");

    const initialTheme: Theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(initialTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme =
      theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    localStorage.setItem("twinit-theme", nextTheme);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (password.length < 8) {
        throw new Error(
          "Password must contain at least 8 characters."
        );
      }

      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "signup") {
        if (!name.trim()) {
          throw new Error("Please enter your full name.");
        }

        const { data, error: authError } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: { full_name: name.trim() },
              emailRedirectTo:
                `${window.location.origin}/auth/callback?next=/onboarding`,
            },
          });

        if (authError) throw authError;

        if (data.session) {
          router.push("/onboarding");
          router.refresh();
          return;
        }

        setMessage(
          "Account created! Check your inbox and click the confirmation link to activate your TwinIT account."
        );
      } else {
        const { data, error: authError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (authError) throw authError;

        if (!data.session) {
          throw new Error("Sign-in failed. Please try again.");
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Supabase. Check your configuration."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  const darkMode = theme === "dark";

  const inputClass = `w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ${
    darkMode
      ? "border-slate-700 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-900"
  }`;

  const textClass = darkMode
    ? "text-slate-100"
    : "text-slate-900";

  const mutedClass = darkMode
    ? "text-slate-400"
    : "text-slate-500";

  return (
    <main
      className={`relative flex min-h-screen transition-colors duration-300 ${
        darkMode
          ? "bg-[#080D1A] text-white"
          : "bg-[#F7F8FC] text-slate-900"
      }`}
    >
      {/* Dark / Light Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
        title={`Switch to ${darkMode ? "light" : "dark"} mode`}
        className={`fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium shadow-sm transition ${
          darkMode
            ? "border-slate-700 bg-slate-900 text-yellow-300 hover:bg-slate-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
        }`}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        <span>{darkMode ? "Light mode" : "Dark mode"}</span>
      </button>

      {/* Branding / Hero */}
      <section className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-[#10152B] p-12 text-white lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <Image
            src="/icon.png" 
            alt="TwinIT logo"
            width={52}
            height={52}
            priority
            className="rounded-xl object-cover"
          />

          <div>
            <div className="text-2xl font-extrabold">
              Twin<span className="text-indigo-400">IT</span>
            </div>
            <div className="text-[10px] tracking-[0.2em] text-slate-400">
              BUSINESS DIGITAL TWINS
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-200">
            <Sparkles size={14} />
            A smarter way to run your business
          </div>

          <h1 className="text-5xl font-bold leading-tight">
            See the future of your business{" "}
            <span className="text-indigo-400">
              before it happens.
            </span>
          </h1>

          <p className="mt-6 max-w-md leading-7 text-slate-300">
            Build your business&apos;s digital twin, explore
            possible outcomes, and make confident decisions
            backed by data.
          </p>

          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <p>✓ Simulate decisions before investing</p>
            <p>✓ Understand business performance</p>
            <p>✓ Discover opportunities for growth</p>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          © 2026 TwinIT · Simulate smarter. Decide better.
        </div>
      </section>

      {/* Authentication */}
      <section className="flex flex-1 items-center justify-center px-5 py-20 sm:px-10">
        <div className="w-full max-w-[430px]">
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/twinit-icon.png"
              alt="TwinIT logo"
              width={48}
              height={48}
              priority
              className="rounded-xl object-cover"
            />

            <div className="text-2xl font-extrabold">
              Twin<span className="text-indigo-500">IT</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">
              Welcome to TwinIT
            </div>

            <h2 className={`text-3xl font-bold ${textClass}`}>
              {mode === "signin"
                ? "Welcome back."
                : "Create your account."}
            </h2>

            <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
              {mode === "signin"
                ? "Sign in to continue to your business workspace."
                : "Start building your business digital twin today."}
            </p>
          </div>

          {/* Sign In / Sign Up Tabs */}
          <div
            className={`mb-7 grid grid-cols-2 rounded-xl p-1 ${
              darkMode ? "bg-slate-800" : "bg-slate-100"
            }`}
          >
            {(["signin", "signup"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => switchMode(item)}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  mode === item
                    ? darkMode
                      ? "bg-slate-700 text-white shadow-sm"
                      : "bg-white text-slate-900 shadow-sm"
                    : mutedClass
                }`}
              >
                {item === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="name"
                  className={`mb-2 block text-sm font-medium ${textClass}`}
                >
                  Full name
                </label>

                <div className="relative">
                  <UserRound
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="Your name"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className={`mb-2 block text-sm font-medium ${textClass}`}
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className={`mb-2 block text-sm font-medium ${textClass}`}
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signin"
                      ? "current-password"
                      : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="At least 8 characters"
                  className={`${inputClass} pl-11 pr-12`}
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500"
              >
                {error}
              </div>
            )}

            {message && (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-600 dark:text-emerald-400"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === "signin"
                    ? "Sign in to TwinIT"
                    : "Create account"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className={`mt-6 text-center text-xs leading-5 ${mutedClass}`}>
            {mode === "signup"
              ? "We'll email you a confirmation link. Open it to activate your account."
              : "Secure sign-in powered by Supabase Auth."}
          </p>
        </div>
      </section>
    </main>
  );
}
