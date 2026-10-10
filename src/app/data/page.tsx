"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Package, ReceiptText, TrendingUp, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

type Tab = "monthly" | "transaction" | "product" | "expense";
type Business = { id: string; name: string };
const today = new Date().toISOString().slice(0, 10);
const initial = { month_start: today.slice(0, 7) + "-01", revenue: "", expenses: "", customers_count: "", orders_count: "", marketing_spend: "", notes: "", occurred_at: new Date().toISOString().slice(0, 16), transaction_type: "sale", category: "", amount: "", quantity: "", description: "", product_name: "", product_category: "", selling_price: "", unit_cost: "", stock_quantity: "", reorder_level: "", occurred_on: today, vendor: "", is_recurring: false, expense_notes: "" };
export default function BusinessDataPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [tab, setTab] = useState<Tab>("monthly");
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ monthly: 0, transaction: 0, product: 0, expense: 0 });

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace("/"); return; }
      const { data, error: businessError } = await supabase.from("businesses").select("id,name").eq("user_id", user.id).limit(1).maybeSingle();
      if (businessError || !data) { router.replace("/onboarding"); return; }
      if (!active) return;
      setBusiness(data);
      const [m,t,p,e] = await Promise.all([
        supabase.from("business_monthly_metrics").select("id", {count:"exact",head:true}).eq("business_id",data.id),
        supabase.from("business_transactions").select("id", {count:"exact",head:true}).eq("business_id",data.id),
        supabase.from("business_products").select("id", {count:"exact",head:true}).eq("business_id",data.id),
        supabase.from("business_expenses").select("id", {count:"exact",head:true}).eq("business_id",data.id),
      ]);
      if(active) { setCounts({monthly:m.count||0,transaction:t.count||0,product:p.count||0,expense:e.count||0}); setLoading(false); }
    })();
    return () => { active = false; };
  }, [router]);

  function set<K extends keyof typeof initial>(key: K, value: typeof initial[K]) { setForm(current => ({...current, [key]:value})); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!business || saving) return;
    setSaving(true); setError(""); setNotice("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); setSaving(false); return; }
    const num = (v:string) => Number(v || 0);
    let table: string;
    let payload: Record<string, unknown> = { user_id:user.id, business_id:business.id };
    if (tab === "monthly") {
      table="business_monthly_metrics";
      payload={...payload,month_start:form.month_start,revenue:num(form.revenue),expenses:num(form.expenses),customers_count:form.customers_count?num(form.customers_count):null,orders_count:form.orders_count?num(form.orders_count):null,marketing_spend:form.marketing_spend?num(form.marketing_spend):null,notes:form.notes.trim()||null};
    } else if (tab === "transaction") {
      table="business_transactions";
      payload={...payload,occurred_at:new Date(form.occurred_at).toISOString(),transaction_type:form.transaction_type,category:form.category.trim()||"uncategorized",amount:num(form.amount),quantity:form.quantity?num(form.quantity):null,description:form.description.trim()||null};
    } else if (tab === "product") {
      table="business_products";
      if(!form.product_name.trim()){setError("Enter a product name.");setSaving(false);return;}
      payload={...payload,name:form.product_name.trim(),category:form.product_category.trim()||null,selling_price:num(form.selling_price),unit_cost:num(form.unit_cost),stock_quantity:num(form.stock_quantity),reorder_level:num(form.reorder_level)};
    } else {
      table="business_expenses";
      payload={...payload,occurred_on:form.occurred_on,category:form.category.trim()||"uncategorized",amount:num(form.amount),vendor:form.vendor.trim()||null,is_recurring:form.is_recurring,notes:form.expense_notes.trim()||null};
    }
    const {error:insertError}=await supabase.from(table).insert(payload);
    if(insertError) setError(insertError.message.includes("business_monthly_metrics")||insertError.message.includes("business_transactions")||insertError.message.includes("business_products")||insertError.message.includes("business_expenses")?"Run database/migrations/ai_business_data.sql in Supabase SQL Editor first.":insertError.message);
    else {
      setNotice("Record saved. Your AI analyst can use it in future analysis."); setCounts(c=>({...c,[tab]:c[tab]+1}));
      if(tab==="monthly")setForm(c=>({...c,revenue:"",expenses:"",customers_count:"",orders_count:"",marketing_spend:"",notes:""}));
      if(tab==="transaction")setForm(c=>({...c,amount:"",quantity:"",category:"",description:""}));
      if(tab==="product")setForm(c=>({...c,product_name:"",product_category:"",selling_price:"",unit_cost:"",stock_quantity:"",reorder_level:""}));
      if(tab==="expense")setForm(c=>({...c,amount:"",category:"",vendor:"",expense_notes:"",is_recurring:false}));
    }
    setSaving(false);
  }

  if(loading)return <div className="app-shell"><Sidebar/><main className="main-panel"><div className="loading-state"><span className="loader"/><p>Loading business data…</p></div></main></div>;
  const tabs: {id:Tab;label:string;icon:typeof TrendingUp}[]=[{id:"monthly",label:"Monthly actuals",icon:TrendingUp},{id:"transaction",label:"Transaction",icon:ReceiptText},{id:"product",label:"Products & stock",icon:Package},{id:"expense",label:"Expense",icon:Database}];
  return <div className="app-shell"><Sidebar/><main className="main-panel"><header className="topbar"><div><span className="eyebrow">WORKSPACE / DATA CENTER</span><h1>Business data center</h1></div><div className="topbar-actions"><span className="date-pill"><span className="status-dot"/> {business?.name}</span></div></header><div className="page-content">
    <section className="feature-hero"><div className="feature-hero-icon"><Database size={24}/></div><div><span className="section-kicker">FEED YOUR DIGITAL TWIN</span><h2>Build a reliable business history</h2><p>Record actual results and operational details to ground your AI analysis.</p></div></section>
    <div className="data-count-grid">{[{label:"Monthly records",count:counts.monthly},{label:"Transactions",count:counts.transaction},{label:"Products",count:counts.product},{label:"Expense records",count:counts.expense}].map(x=><div className="data-count-card" key={x.label}><span>{x.label}</span><b>{x.count}</b></div>)}</div>
    <section className="panel data-entry-panel"><div className="data-tabs">{tabs.map(({id,label,icon:Icon})=><button type="button" key={id} onClick={()=>{setTab(id);setError("");setNotice("");}} className={tab===id?"selected":""}><Icon size={16}/>{label}</button>)}</div><form className="data-form" onSubmit={submit}>
      {tab==="monthly"&&<><div className="data-form-intro"><h3>Monthly business actuals</h3><p>Enter actual figures from your accounts. Use one row per month.</p></div><label>Month<input type="date" value={form.month_start} onChange={e=>set("month_start",e.target.value)} required/></label><div className="data-form-grid"><label>Revenue (₹)<input type="number" min="0" step="0.01" value={form.revenue} onChange={e=>set("revenue",e.target.value)} required placeholder="450000"/></label><label>Expenses (₹)<input type="number" min="0" step="0.01" value={form.expenses} onChange={e=>set("expenses",e.target.value)} required placeholder="315000"/></label><label>Customers in month<input type="number" min="0" value={form.customers_count} onChange={e=>set("customers_count",e.target.value)} placeholder="Optional"/></label><label>Orders in month<input type="number" min="0" value={form.orders_count} onChange={e=>set("orders_count",e.target.value)} placeholder="Optional"/></label><label>Marketing spend (₹)<input type="number" min="0" step="0.01" value={form.marketing_spend} onChange={e=>set("marketing_spend",e.target.value)} placeholder="Optional"/></label></div><label>Notes<textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="Seasonality, promotions, unusual costs…"/></label></>}
      {tab==="transaction"&&<><div className="data-form-intro"><h3>Record a transaction</h3><p>Use consistent categories and dates for better comparisons.</p></div><label>Date and time<input type="datetime-local" value={form.occurred_at} onChange={e=>set("occurred_at",e.target.value)} required/></label><div className="data-form-grid"><label>Type<select value={form.transaction_type} onChange={e=>set("transaction_type",e.target.value)}><option value="sale">Sale</option><option value="refund">Refund</option><option value="purchase">Purchase</option><option value="other">Other</option></select></label><label>Amount (₹)<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} required/></label><label>Category<input value={form.category} onChange={e=>set("category",e.target.value)} placeholder="e.g. apparel"/></label><label>Quantity<input type="number" min="0" step="0.001" value={form.quantity} onChange={e=>set("quantity",e.target.value)} placeholder="Optional"/></label></div><label>Description<input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Avoid customer personal data"/></label></>}
      {tab==="product"&&<><div className="data-form-intro"><h3>Product and inventory</h3><p>Track unit economics and stock levels.</p></div><div className="data-form-grid"><label>Product name<input value={form.product_name} onChange={e=>set("product_name",e.target.value)} required/></label><label>Category<input value={form.product_category} onChange={e=>set("product_category",e.target.value)} placeholder="Optional"/></label><label>Selling price (₹)<input type="number" min="0" step="0.01" value={form.selling_price} onChange={e=>set("selling_price",e.target.value)} required/></label><label>Unit cost (₹)<input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e=>set("unit_cost",e.target.value)} required/></label><label>Stock quantity<input type="number" min="0" step="0.001" value={form.stock_quantity} onChange={e=>set("stock_quantity",e.target.value)} required/></label><label>Reorder threshold<input type="number" min="0" step="0.001" value={form.reorder_level} onChange={e=>set("reorder_level",e.target.value)} required/></label></div></>}
      {tab==="expense"&&<><div className="data-form-intro"><h3>Record an expense</h3><p>Track recurring and changing operating costs.</p></div><div className="data-form-grid"><label>Date<input type="date" value={form.occurred_on} onChange={e=>set("occurred_on",e.target.value)} required/></label><label>Amount (₹)<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} required/></label><label>Category<input value={form.category} onChange={e=>set("category",e.target.value)} required placeholder="rent, salaries, utilities"/></label><label>Vendor (optional)<input value={form.vendor} onChange={e=>set("vendor",e.target.value)}/></label></div><label className="data-checkbox"><input type="checkbox" checked={form.is_recurring} onChange={e=>set("is_recurring",e.target.checked)}/> This is a recurring expense</label><label>Notes<textarea value={form.expense_notes} onChange={e=>set("expense_notes",e.target.value)} rows={2}/></label></>}
      {error&&<div className="data-alert error"><CircleAlert size={16}/>{error}</div>}{notice&&<div className="data-alert success"><CheckCircle2 size={16}/>{notice}</div>}<div className="data-submit-row"><p>Records are private to your signed-in account.</p><button className="primary-button" type="submit" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<Database size={16}/>}Save record</button></div>
    </form></section><footer className="page-footer">TwinIT <span>·</span> Simulate smarter. Decide better. <span className="footer-right">Use actual figures wherever possible.</span></footer>
  </div></main></div>;
}
