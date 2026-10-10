"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

type RecordData = Record<string, unknown>;

type Dataset = {
  records: RecordData[];
  available: boolean;
  error?: string;
};

type BusinessReportData = {
  business: RecordData;
  profile: RecordData;
  transactions: Dataset;
  products: Dataset;
  expenses: Dataset;
};

type Metric = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(value: number) {
  return CURRENCY.format(Number.isFinite(value) ? value : 0);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[₹,\s]/g, ""));

  return Number.isFinite(result) ? result : null;
}

function getNumber(
  record: RecordData,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = numberValue(record[key]);
    if (value !== null) return value;
  }
  return fallback;
}

function getText(
  record: RecordData,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function getDate(record: RecordData): Date | null {
  const value = getText(record, [
    "date",
    "transaction_date",
    "expense_date",
    "created_at",
    "sale_date",
    "updated_at",
  ]);

  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateProfileMetrics(
  business: RecordData,
  profile: RecordData,
): Metric {
  const merged = { ...profile, ...business };

  const revenue = getNumber(merged, [
    "monthly_revenue",
    "monthlyRevenue",
    "revenue",
    "monthly_sales",
    "monthly_sales_amount",
  ]);

  const expenses = getNumber(merged, [
    "monthly_expenses",
    "monthlyExpenses",
    "expenses",
    "monthly_costs",
    "monthly_operating_costs",
  ]);

  const profit = revenue - expenses;

  return {
    revenue,
    expenses,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

function summarizeTransactions(records: RecordData[]) {
  const total = records.reduce((sum, record) => {
    return (
      sum +
      Math.max(
        0,
        getNumber(record, [
          "amount",
          "total_amount",
          "sale_amount",
          "total",
          "revenue",
          "grand_total",
        ]),
      )
    );
  }, 0);

  const dated = records
    .map((record) => ({
      date: getDate(record),
      amount: Math.max(
        0,
        getNumber(record, [
          "amount",
          "total_amount",
          "sale_amount",
          "total",
          "revenue",
          "grand_total",
        ]),
      ),
    }))
    .filter(
      (item): item is { date: Date; amount: number } =>
        item.date !== null,
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const first = dated[0]?.date ?? null;
  const last = dated[dated.length - 1]?.date ?? null;

  return {
    count: records.length,
    total,
    average: records.length > 0 ? total / records.length : 0,
    datedCount: dated.length,
    firstDate: first?.toISOString().slice(0, 10) ?? null,
    lastDate: last?.toISOString().slice(0, 10) ?? null,
  };
}

function summarizeExpenses(records: RecordData[]) {
  const total = records.reduce((sum, record) => {
    return (
      sum +
      Math.max(
        0,
        getNumber(record, [
          "amount",
          "expense_amount",
          "total",
          "cost",
          "value",
        ]),
      )
    );
  }, 0);

  const categories: Record<string, number> = {};

  for (const record of records) {
    const category = getText(
      record,
      ["category", "expense_category", "type", "name"],
      "Uncategorized",
    );

    categories[category] =
      (categories[category] ?? 0) +
      Math.max(
        0,
        getNumber(record, [
          "amount",
          "expense_amount",
          "total",
          "cost",
          "value",
        ]),
      );
  }

  return {
    count: records.length,
    total,
    categories: Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount]) => ({ category, amount })),
  };
}

function summarizeProducts(records: RecordData[]) {
  const inventoryValue = records.reduce((sum, record) => {
    const quantity = Math.max(
      0,
      getNumber(record, [
        "quantity",
        "stock",
        "stock_quantity",
        "inventory_quantity",
      ]),
    );

    const unitCost = Math.max(
      0,
      getNumber(record, [
        "cost_price",
        "purchase_price",
        "unit_cost",
        "cost",
      ]),
    );

    return sum + quantity * unitCost;
  }, 0);

  const lowStock = records.filter((record) => {
    const quantity = getNumber(record, [
      "quantity",
      "stock",
      "stock_quantity",
      "inventory_quantity",
    ]);

    const threshold = getNumber(record, [
      "reorder_level",
      "low_stock_threshold",
      "minimum_stock",
    ]);

    return (
      quantity >= 0 &&
      (record.quantity !== undefined ||
        record.stock !== undefined ||
        record.stock_quantity !== undefined ||
        record.inventory_quantity !== undefined) &&
      quantity <= (threshold > 0 ? threshold : 5)
    );
  }).length;

  return {
    count: records.length,
    inventoryValue,
    lowStock,
  };
}

function findMissingData(data: BusinessReportData) {
  const missing: string[] = [];
  const business = { ...data.profile, ...data.business };

  const hasRevenue = [
    "monthly_revenue",
    "monthlyRevenue",
    "revenue",
    "monthly_sales",
    "monthly_sales_amount",
  ].some((key) => numberValue(business[key]) !== null);

  const hasExpenses = [
    "monthly_expenses",
    "monthlyExpenses",
    "expenses",
    "monthly_costs",
    "monthly_operating_costs",
  ].some((key) => numberValue(business[key]) !== null);

  if (!hasRevenue) missing.push("Monthly revenue baseline");
  if (!hasExpenses) missing.push("Monthly expense baseline");

  if (!data.transactions.available) {
    missing.push("Accessible transaction history");
  } else if (data.transactions.records.length === 0) {
    missing.push("Recorded sales transactions");
  }

  if (!data.expenses.available) {
    missing.push("Accessible itemized expense records");
  } else if (data.expenses.records.length === 0) {
    missing.push("Itemized expense history");
  }

  if (!data.products.available) {
    missing.push("Accessible product and inventory records");
  } else if (data.products.records.length === 0) {
    missing.push("Product and inventory records");
  }

  if (
    !getText(business, [
      "business_type",
      "industry",
      "category",
      "business_category",
    ])
  ) {
    missing.push("Business industry or category");
  }

  if (
    !getText(business, [
      "location",
      "city",
      "address",
      "business_location",
    ])
  ) {
    missing.push("Business location");
  }

  if (
    !getText(business, [
      "description",
      "business_description",
      "about",
    ])
  ) {
    missing.push("Business description and objectives");
  }

  return missing;
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="report-stat">
      <div className="report-stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();

  const [data, setData] = useState<BusinessReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/");
        return;
      }

      const [businessResult, profileResult] = await Promise.all([
        supabase
          .from("businesses")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (businessResult.error) {
        throw new Error(businessResult.error.message);
      }

      if (!businessResult.data) {
        router.replace("/onboarding");
        return;
      }

      const [transactionResult, productResult, expenseResult] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .limit(5000),

          supabase
            .from("products")
            .select("*")
            .eq("user_id", user.id)
            .limit(5000),

          supabase
            .from("expenses")
            .select("*")
            .eq("user_id", user.id)
            .limit(5000),
        ]);

      const toDataset = (
        result: {
          data: unknown[] | null;
          error: { message: string } | null;
        },
      ): Dataset => ({
        records: (result.data ?? []) as RecordData[],
        available: !result.error,
        error: result.error?.message,
      });

      setData({
        business: (businessResult.data ?? {}) as RecordData,
        profile: (profileResult.data ?? {}) as RecordData,
        transactions: toDataset(transactionResult),
        products: toDataset(productResult),
        expenses: toDataset(expenseResult),
      });

      setReport("");
      setGeneratedAt("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your business information.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo(
    () =>
      data
        ? calculateProfileMetrics(data.business, data.profile)
        : { revenue: 0, expenses: 0, profit: 0, margin: 0 },
    [data],
  );

  const transactionSummary = useMemo(
    () => summarizeTransactions(data?.transactions.records ?? []),
    [data],
  );

  const expenseSummary = useMemo(
    () => summarizeExpenses(data?.expenses.records ?? []),
    [data],
  );

  const productSummary = useMemo(
    () => summarizeProducts(data?.products.records ?? []),
    [data],
  );

  const missingData = useMemo(
    () => (data ? findMissingData(data) : []),
    [data],
  );

  const businessName = data
    ? getText(
        { ...data.profile, ...data.business },
        ["name", "business_name", "company_name"],
        "Your business",
      )
    : "Your business";

  const hasRecordedTransactions =
    Boolean(data?.transactions.available) &&
    transactionSummary.count > 0;

  async function generateReport() {
    if (!data) return;

    setGenerating(true);
    setError("");
    setReport("");

    try {
      const merged = { ...data.profile, ...data.business };

      const businessContext = {
        businessName,
        businessType: getText(
          merged,
          ["business_type", "industry", "category", "business_category"],
          "Not provided",
        ),
        location: getText(
          merged,
          ["location", "city", "address", "business_location"],
          "Not provided",
        ),
        description: getText(
          merged,
          ["description", "business_description", "about"],
          "Not provided",
        ),
        objectives: getText(
          merged,
          ["goals", "business_goals", "objectives"],
          "Not provided",
        ),
        monthlyProfileFigures: {
          revenue: metrics.revenue,
          expenses: metrics.expenses,
          calculatedProfit: metrics.profit,
          calculatedProfitMarginPercent: metrics.margin,
        },
        profileFields: {
          employees: getNumber(merged, [
            "employees",
            "employee_count",
            "number_of_employees",
          ]),
          customersPerDay: getNumber(merged, [
            "customers_per_day",
            "daily_customers",
            "customers_daily",
          ]),
          averageOrderValue: getNumber(merged, [
            "average_order_value",
            "averageOrderValue",
            "aov",
          ]),
          marketingSpend: getNumber(merged, [
            "monthly_marketing_spend",
            "marketing_spend",
            "monthly_marketing_budget",
          ]),
        },
        transactionData: {
          available: data.transactions.available,
          recordCount: transactionSummary.count,
          sumOfRecognizedAmounts: transactionSummary.total,
          averageRecognizedAmount: transactionSummary.average,
          recordsWithDates: transactionSummary.datedCount,
          firstDate: transactionSummary.firstDate,
          lastDate: transactionSummary.lastDate,
        },
        productData: {
          available: data.products.available,
          productCount: productSummary.count,
          lowStockCount: productSummary.lowStock,
          estimatedInventoryCostValue: productSummary.inventoryValue,
        },
        expenseData: {
          available: data.expenses.available,
          recordCount: expenseSummary.count,
          sumOfRecognizedAmounts: expenseSummary.total,
          largestCategories: expenseSummary.categories,
        },
        dataLimitations: {
          missingOrIncomplete: missingData,
          transactionQueryError: data.transactions.error ?? null,
          productQueryError: data.products.error ?? null,
          expenseQueryError: data.expenses.error ?? null,
          note:
            "Supabase queries are limited to 5000 rows per dataset. Amount totals use recognized column names only. Do not assume the transaction and expense totals cover a complete period.",
        },
      };

      const prompt = `
You are TwinIT's senior business intelligence analyst.

Produce the final consolidated business workflow report for ${businessName} using only the supplied business context.

BUSINESS DATA:
${JSON.stringify(businessContext, null, 2)}

REPORT STRUCTURE:

# Executive Summary
Summarize the current state of the business, what is known, and the biggest priorities.

# Business Profile and Operations
Describe the business using the available industry, location, description, staffing, customers and product information. Explicitly identify missing profile details.

# Financial Health
Interpret the profile's monthly revenue, expenses, calculated profit and margin. Distinguish these profile figures from totals calculated from individual transaction records. Never add them together or treat them as equivalent without evidence that the periods and accounting definitions match.

# Sales and Customers
Discuss transaction count, recognized transaction amounts, date coverage and average recognized transaction amount where available. Do not call the average a customer average unless customer data supports that.

# Products, Inventory and Expenses
Discuss recorded products, possible low-stock items and expense categories only when data supports them. Explain limitations where the relevant tables or fields are unavailable.

# Risks and Operational Gaps
Identify evidenced risks and important missing information. Distinguish confirmed findings from potential risks that require validation.

# Opportunities and Recommendations
Provide 3–5 actionable recommendations prioritized by impact and feasibility. Tie them to available business information. Avoid unsupported promises.

# KPIs to Track
Recommend a short table of KPIs, definitions and suggested tracking frequency. Mark any suggested target as provisional, not an established business benchmark.

# 30-Day Action Plan
Organize practical actions into Week 1, Week 2, Week 3 and Week 4.

# Data Confidence and Limitations
State which findings are based on profile data, which use recorded rows, which data could not be accessed, and which conclusions are uncertain. Do not invent facts or historical trends.

IMPORTANT RULES:
- Use INR for monetary amounts.
- The profile profit is revenue minus expenses; this is a calculation, not an audited result.
- No trend or forecast is justified without appropriate dated historical observations.
- The recognized transaction and expense sums may be incomplete or cover different periods.
- Never invent customer numbers, products, expense categories, sales trends, market share, causes or probabilities.
- A query error means data could not be accessed; it does not prove that no records exist.
- Be concise, useful and specific. Use readable Markdown headings, bullets and tables.
- Include the report generation date.
      `.trim();

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The AI analyst could not generate the report.",
        );
      }

      if (!result.answer) {
        throw new Error("The AI returned an empty report.");
      }

      setReport(result.answer);
      setGeneratedAt(new Date().toLocaleString("en-IN"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate your business report.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function downloadReport() {
    if (!report) return;

    const content = [
      `# ${businessName} — TwinIT Business Report`,
      `Generated: ${generatedAt}`,
      "",
      report,
      "",
      "---",
      "Generated by TwinIT. AI-generated analysis should be checked against source records.",
    ].join("\n");

    const blob = new Blob(["\uFEFF", content], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-business-report.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-panel">
          <div className="page-content report-loading">
            <LoaderCircle className="report-spin" size={28} />
            <p>Gathering your business information…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / BUSINESS REPORTS</span>
            <h1>Business intelligence report</h1>
          </div>

          <div className="topbar-actions">
            <span className="date-pill">
              <span className="status-dot" />
              Consolidated business view
            </span>

            <button
              className="small-outline"
              onClick={() => void loadData()}
              disabled={loading || generating}
            >
              <RefreshCw size={14} />
              Refresh data
            </button>
          </div>
        </header>

        <div className="page-content report-page">
          <section className="feature-hero">
            <div className="feature-hero-icon">
              <FileText size={24} />
            </div>
            <div>
              <span className="section-kicker">TWINIT BUSINESS INTELLIGENCE</span>
              <h2>Your business, in one report.</h2>
              <p>
                Consolidate your saved business details, financial profile,
                sales records, products and expenses into one AI-assisted
                assessment of {businessName}.
              </p>
            </div>
          </section>

          {error && (
            <div className="report-error" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              <section className="report-business-banner">
                <div className="report-business-icon">
                  <Building2 size={23} />
                </div>
                <div className="report-business-info">
                  <span className="section-kicker">BUSINESS PROFILE</span>
                  <h2>{businessName}</h2>
                  <p>
                    {getText(
                      { ...data.profile, ...data.business },
                      ["business_type", "industry", "category", "business_category"],
                      "Business category not provided",
                    )}
                    {" · "}
                    {getText(
                      { ...data.profile, ...data.business },
                      ["location", "city", "business_location"],
                      "Location not provided",
                    )}
                  </p>
                </div>
                <div className="report-record-badge">
                  <Activity size={15} />
                  {transactionSummary.count} sales records
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <div>
                    <span className="section-kicker">CURRENT POSITION</span>
                    <h2>Financial snapshot</h2>
                    <p>
                      Based on the saved profile values—not a verified
                      accounting statement.
                    </p>
                  </div>
                </div>

                <div className="report-stats-grid">
                  <StatCard
                    label="Monthly revenue"
                    value={money(metrics.revenue)}
                    note="Profile figure"
                    icon={BarChart3}
                  />
                  <StatCard
                    label="Monthly expenses"
                    value={money(metrics.expenses)}
                    note="Profile figure"
                    icon={Wallet}
                  />
                  <StatCard
                    label="Calculated profit"
                    value={money(metrics.profit)}
                    note="Revenue minus expenses"
                    icon={TrendingUp}
                  />
                  <StatCard
                    label="Profit margin"
                    value={`${metrics.margin.toFixed(1)}%`}
                    note="Calculated from profile figures"
                    icon={Activity}
                  />
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <div>
                    <span className="section-kicker">WORKFLOW COVERAGE</span>
                    <h2>What TwinIT can currently access</h2>
                    <p>
                      Data coverage helps explain how complete the final
                      report can be.
                    </p>
                  </div>
                </div>

                <div className="report-coverage-grid">
                  <div className="report-coverage-card">
                    <div>
                      <BarChart3 size={19} />
                      <strong>Transactions</strong>
                    </div>
                    <b>{data.transactions.records.length}</b>
                    <span>
                      {data.transactions.available
                        ? "Query completed"
                        : "Query failed or access denied"}
                    </span>
                  </div>

                  <div className="report-coverage-card">
                    <div>
                      <Boxes size={19} />
                      <strong>Products</strong>
                    </div>
                    <b>{data.products.records.length}</b>
                    <span>
                      {data.products.available
                        ? "Query completed"
                        : "Query failed or access denied"}
                    </span>
                  </div>

                  <div className="report-coverage-card">
                    <div>
                      <Wallet size={19} />
                      <strong>Expense records</strong>
                    </div>
                    <b>{data.expenses.records.length}</b>
                    <span>
                      {data.expenses.available
                        ? "Query completed"
                        : "Query failed or access denied"}
                    </span>
                  </div>

                  <div className="report-coverage-card">
                    <div>
                      <Clock3 size={19} />
                      <strong>Transaction dates</strong>
                    </div>
                    <b>{transactionSummary.datedCount}</b>
                    <span>
                      {transactionSummary.firstDate &&
                      transactionSummary.lastDate
                        ? `${transactionSummary.firstDate} – ${transactionSummary.lastDate}`
                        : "No recognized dated transactions"}
                    </span>
                  </div>
                </div>

                <div className="report-data-notice">
                  <ShieldCheck size={18} />
                  <p>
                    Each dataset is loaded using the signed-in user's
                    Supabase session. Query failures are shown as unavailable
                    rather than treated as proof that no records exist.
                    Each dataset is limited to the first 5,000 rows returned.
                  </p>
                </div>
              </section>

              <section className="report-section">
                <div className="report-section-heading">
                  <div>
                    <span className="section-kicker">DATA COMPLETENESS</span>
                    <h2>Information gaps to resolve</h2>
                    <p>
                      Missing information limits the depth and confidence
                      of the final assessment.
                    </p>
                  </div>

                  <span className="report-count-pill">
                    {missingData.length} gaps identified
                  </span>
                </div>

                {missingData.length === 0 ? (
                  <div className="report-complete">
                    <CheckCircle2 size={19} />
                    <span>
                      The basic profile fields and record datasets checked
                      by this page are available. This does not guarantee
                      that all records are complete or accurate.
                    </span>
                  </div>
                ) : (
                  <div className="report-missing-list">
                    {missingData.map((item) => (
                      <div key={item}>
                        <AlertTriangle size={17} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel report-generator">
                <div className="report-generator-heading">
                  <div className="report-ai-icon">
                    <Bot size={23} />
                  </div>
                  <div>
                    <span className="section-kicker">GROQ AI ANALYST</span>
                    <h2>Generate the final business report</h2>
                    <p>
                      Analyze the accessible business information and
                      prepare an executive summary, operational assessment,
                      risks, opportunities, KPIs and a 30-day action plan.
                    </p>
                  </div>
                </div>

                <div className="report-contents-grid">
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Executive summary</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Financial health</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Sales and operations</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Risks and opportunities</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>Prioritized recommendations</span>
                  </div>
                  <div>
                    <CheckCircle2 size={17} />
                    <span>30-day action plan</span>
                  </div>
                </div>

                <button
                  className="report-generate-button"
                  onClick={() => void generateReport()}
                  disabled={generating || !data}
                >
                  {generating ? (
                    <LoaderCircle className="report-spin" size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {generating
                    ? "Analyzing your business…"
                    : report
                      ? "Regenerate business report"
                      : "Generate final business report"}
                </button>

                <p className="report-generator-note">
                  Uses the existing /api/ai/chat endpoint. Only a summarized
                  business context is sent for AI analysis; the full raw
                  record lists are not sent to Groq.
                </p>
              </section>

              {report && (
                <section className="panel report-output">
                  <div className="report-output-heading">
                    <div>
                      <span className="section-kicker">
                        CONSOLIDATED ASSESSMENT
                      </span>
                      <h2>{businessName} — Final Report</h2>
                      <p>
                        Generated {generatedAt}. Refresh the data and
                        regenerate after updating your business records.
                      </p>
                    </div>

                    <button
                      className="small-outline"
                      onClick={downloadReport}
                    >
                      <ArrowDownToLine size={15} />
                      Export report
                    </button>
                  </div>

                  <div className="report-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report}
                    </ReactMarkdown>
                  </div>

                  <div className="report-footer-note">
                    <ShieldCheck size={17} />
                    <span>
                      AI-generated analysis is not an audit or a guarantee
                      of future performance. Verify important findings
                      against the underlying business records.
                    </span>
                  </div>
                </section>
              )}

              <section className="report-section">
                <div className="report-section-heading">
                  <div>
                    <span className="section-kicker">SOURCE DATA SUMMARY</span>
                    <h2>Recognized record totals</h2>
                    <p>
                      These sums are shown separately from profile monthly
                      figures because their accounting periods may differ.
                    </p>
                  </div>
                </div>

                <div className="report-source-grid">
                  <div>
                    <span>Recognized transaction amounts</span>
                    <strong>{money(transactionSummary.total)}</strong>
                    <small>
                      {transactionSummary.count} records ·{" "}
                      {transactionSummary.datedCount} with dates
                    </small>
                  </div>

                  <div>
                    <span>Recognized expense amounts</span>
                    <strong>{money(expenseSummary.total)}</strong>
                    <small>
                      {expenseSummary.count} records
                    </small>
                  </div>

                  <div>
                    <span>Estimated inventory cost value</span>
                    <strong>{money(productSummary.inventoryValue)}</strong>
                    <small>
                      {productSummary.count} products with recognized
                      quantity and cost fields
                    </small>
                  </div>
                </div>

                <p className="report-small-note">
                  These totals use recognized field names and available
                  rows only. They may be incomplete and should not be
                  interpreted as audited revenue, expenses or inventory
                  valuation.
                </p>
              </section>
            </>
          )}

          <footer className="page-footer">
            TwinIT <span>·</span> Simulate smarter. Decide better.
            <span className="footer-right">
              Consolidated business intelligence
            </span>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .report-page {
          --report-border: #e2e8f0;
          --report-muted: #64748b;
          --report-text: #0f172a;
        }

        .report-section {
          margin: 1.7rem 0;
        }

        .report-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .report-section-heading h2 {
          margin: 0.35rem 0;
          font-size: 1.2rem;
          font-weight: 750;
        }

        .report-section-heading p {
          margin: 0.3rem 0 0;
          color: var(--report-muted);
          font-size: 0.84rem;
          line-height: 1.6;
        }

        .report-business-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.3rem 0;
          padding: 1.15rem;
          border: 1px solid var(--report-border);
          border-radius: 0.85rem;
          background: white;
        }

        .report-business-icon,
        .report-ai-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          flex-shrink: 0;
          border-radius: 0.75rem;
          background: #eff6ff;
          color: #2563eb;
        }

        .report-business-info {
          min-width: 0;
          flex: 1;
        }

        .report-business-info h2 {
          margin: 0.3rem 0;
          font-size: 1.1rem;
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .report-business-info p {
          margin: 0;
          color: var(--report-muted);
          font-size: 0.8rem;
        }

        .report-record-badge,
        .report-count-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.65rem;
          border: 1px solid var(--report-border);
          border-radius: 999px;
          color: var(--report-muted);
          font-size: 0.73rem;
          white-space: nowrap;
        }

        .report-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .report-stat {
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--report-border);
          border-radius: 0.8rem;
          background: white;
        }

        .report-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          color: var(--report-muted);
          font-size: 0.78rem;
        }

        .report-stat > strong {
          display: block;
          margin-top: 0.85rem;
          font-size: clamp(1.1rem, 2vw, 1.55rem);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .report-stat > small {
          display: block;
          margin-top: 0.4rem;
          color: var(--report-muted);
          font-size: 0.72rem;
          line-height: 1.5;
        }

        .report-coverage-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .report-coverage-card {
          display: grid;
          gap: 0.65rem;
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--report-border);
          border-radius: 0.8rem;
          background: white;
        }

        .report-coverage-card > div {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 650;
        }

        .report-coverage-card > b {
          font-size: 1.6rem;
          font-weight: 750;
        }

        .report-coverage-card > span {
          color: var(--report-muted);
          font-size: 0.72rem;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .report-data-notice,
        .report-complete,
        .report-footer-note {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          margin-top: 1rem;
          padding: 0.85rem;
          border: 1px solid var(--report-border);
          border-radius: 0.65rem;
          color: var(--report-muted);
          font-size: 0.78rem;
          line-height: 1.65;
        }

        .report-data-notice svg,
        .report-complete svg,
        .report-footer-note svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .report-data-notice p {
          margin: 0;
        }

        .report-complete {
          border-color: #a7f3d0;
          background: #ecfdf5;
          color: #065f46;
        }

        .report-missing-list {
          display: grid;
          gap: 0.55rem;
        }

        .report-missing-list > div {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.75rem 0.85rem;
          border: 1px solid var(--report-border);
          border-radius: 0.6rem;
          background: white;
          font-size: 0.81rem;
        }

        .report-missing-list svg {
          flex-shrink: 0;
          color: #b45309;
        }

        .report-generator,
        .report-output {
          margin: 1.5rem 0;
          padding: 1.25rem;
        }

        .report-generator-heading {
          display: flex;
          align-items: flex-start;
          gap: 0.9rem;
        }

        .report-generator-heading h2,
        .report-output-heading h2 {
          margin: 0.3rem 0;
          font-size: 1.15rem;
          font-weight: 750;
        }

        .report-generator-heading p,
        .report-output-heading p {
          margin: 0.35rem 0 0;
          color: var(--report-muted);
          font-size: 0.83rem;
          line-height: 1.65;
        }

        .report-ai-icon {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .report-contents-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin: 1.3rem 0;
        }

        .report-contents-grid > div {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
          padding: 0.7rem;
          border: 1px solid var(--report-border);
          border-radius: 0.55rem;
          font-size: 0.78rem;
        }

        .report-contents-grid svg {
          flex-shrink: 0;
          color: #059669;
        }

        .report-generate-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          padding: 0.85rem 1.1rem;
          border: none;
          border-radius: 0.6rem;
          background: #0f172a;
          color: white;
          font-size: 0.85rem;
          font-weight: 650;
          cursor: pointer;
        }

        .report-generate-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .report-generator-note,
        .report-small-note {
          margin: 0.8rem 0 0;
          color: var(--report-muted);
          font-size: 0.74rem;
          line-height: 1.65;
        }

        .report-output-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--report-border);
        }

        .report-markdown {
          padding: 1rem 0;
          overflow-wrap: anywhere;
          font-size: 0.9rem;
          line-height: 1.8;
        }

        .report-markdown h1,
        .report-markdown h2,
        .report-markdown h3 {
          margin: 1.2rem 0 0.55rem;
          font-weight: 750;
          line-height: 1.4;
        }

        .report-markdown h1 {
          font-size: 1.35rem;
        }

        .report-markdown h2 {
          font-size: 1.15rem;
        }

        .report-markdown h3 {
          font-size: 0.98rem;
        }

        .report-markdown p {
          margin: 0.65rem 0;
        }

        .report-markdown ul,
        .report-markdown ol {
          margin: 0.65rem 0;
          padding-left: 1.5rem;
        }

        .report-markdown ul {
          list-style: disc;
        }

        .report-markdown ol {
          list-style: decimal;
        }

        .report-markdown li {
          margin: 0.3rem 0;
        }

        .report-markdown strong {
          font-weight: 750;
        }

        .report-markdown table {
          width: 100%;
          margin: 0.8rem 0;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .report-markdown th,
        .report-markdown td {
          padding: 0.65rem;
          border: 1px solid var(--report-border);
          text-align: left;
          vertical-align: top;
        }

        .report-markdown th {
          background: #f8fafc;
        }

        .report-markdown blockquote {
          margin: 0.8rem 0;
          padding-left: 0.85rem;
          border-left: 3px solid #cbd5e1;
          color: var(--report-muted);
        }

        .report-markdown a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .report-source-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .report-source-grid > div {
          display: grid;
          gap: 0.5rem;
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--report-border);
          border-radius: 0.75rem;
          background: white;
        }

        .report-source-grid span,
        .report-source-grid small {
          color: var(--report-muted);
          font-size: 0.76rem;
          line-height: 1.5;
        }

        .report-source-grid strong {
          font-size: 1.15rem;
          overflow-wrap: anywhere;
        }

        .report-loading {
          display: flex;
          min-height: 250px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 0.8rem;
        }

        .report-loading p {
          color: var(--report-muted);
        }

        .report-spin {
          animation: report-spin 1s linear infinite;
        }

        @keyframes report-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .report-error {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          margin: 1rem 0;
          padding: 0.9rem;
          border: 1px solid #fecaca;
          border-radius: 0.65rem;
          background: #fef2f2;
          color: #991b1b;
          font-size: 0.83rem;
          line-height: 1.6;
        }

        .report-error svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        @media (max-width: 1100px) {
          .report-stats-grid,
          .report-coverage-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .report-contents-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .report-business-banner {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .report-record-badge {
            margin-left: 0;
          }

          .report-stats-grid,
          .report-coverage-grid,
          .report-contents-grid,
          .report-source-grid {
            grid-template-columns: 1fr;
          }

          .report-generator,
          .report-output {
            padding: 0.9rem;
          }

          .report-output-heading {
            flex-direction: column;
          }

          .report-count-pill {
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
