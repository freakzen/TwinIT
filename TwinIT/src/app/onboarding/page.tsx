"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoaderCircle, Upload, UserRound } from "lucide-react";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [monthlyRevenue, setMonthlyRevenue] = useState("100000");
  const [monthlyExpenses, setMonthlyExpenses] = useState("70000");
  const [customersPerDay, setCustomersPerDay] = useState("20");
  const [averageOrderValue, setAverageOrderValue] = useState("500");
  const [employees, setEmployees] = useState("3");
  const [marketingSpend, setMarketingSpend] = useState("5000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const nameFromMetadata =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "";

      const p: Profile = data ?? {
        id: user.id,
        full_name: nameFromMetadata,
        email: user.email ?? null,
        avatar_url: null,
      };

      if (active) {
        setProfile(p);
        setFullName(p.full_name || nameFromMetadata);
        setEmail(p.email || user.email || "");
        setAvatarUrl(p.avatar_url || "");
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [router, supabase]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const revenue = Number(monthlyRevenue);
    const expenses = Number(monthlyExpenses);
    const customers = Number(customersPerDay);
    const orderValue = Number(averageOrderValue);
    const employeeCount = Number(employees);
    const marketing = Number(marketingSpend);

    if (!profile) {
      setError("Your session could not be found. Please sign in again.");
      return;
    }
    if (!fullName.trim() || !businessName.trim()) {
      setError("Enter your name and business name.");
      return;
    }
    if ([revenue, expenses, customers, orderValue, employeeCount, marketing].some(
      (n) => !Number.isFinite(n) || n < 0
    )) {
      setError("Business values must be valid non-negative numbers.");
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;

      if (avatarFile) {
        if (!avatarFile.type.startsWith("image/")) {
          throw new Error("Please choose an image file.");
        }
        if (avatarFile.size > 5 * 1024 * 1024) {
          throw new Error("Profile pictures must be 5 MB or smaller.");
        }

        const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        nextAvatarUrl = publicData.publicUrl;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: profile.id,
        full_name: fullName.trim(),
        email,
        avatar_url: nextAvatarUrl || null,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      const { data: existingBusiness, error: lookupError } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      const businessPayload = {
        user_id: profile.id,
        name: businessName.trim(),
        business_type: businessType,
        currency: "INR",
        monthly_revenue: revenue,
        monthly_expenses: expenses,
        customers_per_day: Math.round(customers),
        average_order_value: orderValue,
        employees: Math.round(employeeCount),
        marketing_spend: marketing,
        updated_at: new Date().toISOString(),
      };

      const businessResult = existingBusiness
        ? await supabase.from("businesses").update(businessPayload).eq("id", existingBusiness.id)
        : await supabase.from("businesses").insert(businessPayload);

      if (businessResult.error) throw businessResult.error;

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-600">TWINIT · SETUP</p>
        <h1 className="mt-2 text-3xl font-bold">Set up your profile</h1>
        <p className="mt-2 text-slate-500">Tell us about yourself and your business to create your first digital twin.</p>

        <form onSubmit={save} className="mt-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your profile</h2>
            <div className="flex flex-wrap items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><UserRound size={32} /></div>
              )}
              <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                <span className="flex items-center gap-2"><Upload size={16} /> Choose profile picture</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
              </label>
              {avatarFile && <span className="text-sm text-slate-500">{avatarFile.name}</span>}
            </div>
            <label className="block text-sm font-medium">Full name
              <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </label>
            <label className="block text-sm font-medium">Email
              <input className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600" value={email} readOnly />
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your business</h2>
            <label className="block text-sm font-medium">Business name
              <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required maxLength={150} placeholder="e.g. Zaid's Retail Store" />
            </label>
            <label className="block text-sm font-medium">Business type
              <select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                {["Retail", "Restaurant / Cafe", "E-commerce", "Manufacturing", "Services", "Wholesale", "Other"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Monthly revenue (₹)" value={monthlyRevenue} setValue={setMonthlyRevenue} />
              <NumberField label="Monthly expenses (₹)" value={monthlyExpenses} setValue={setMonthlyExpenses} />
              <NumberField label="Customers per day" value={customersPerDay} setValue={setCustomersPerDay} />
              <NumberField label="Average order value (₹)" value={averageOrderValue} setValue={setAverageOrderValue} />
              <NumberField label="Number of employees" value={employees} setValue={setEmployees} />
              <NumberField label="Monthly marketing spend (₹)" value={marketingSpend} setValue={setMarketingSpend} />
            </div>
          </section>

          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? <LoaderCircle className="animate-spin" size={18} /> : null}
            {saving ? "Saving..." : "Save profile and create dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">{label}
      <input type="number" min="0" step="any" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
  );
}
