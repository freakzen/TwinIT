"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

type BusinessData = Record<string, unknown>;

type Scenario = {
  id: string;
  name: string;
  description: string;
  color: string;
  revenueGrowth: number;
  expenseGrowth: number;
  marketingIncrease: number;
};

type ForecastMonth = {
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

type ForecastResult = {
  scenario: Scenario;
  months: ForecastMonth[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Slower growth with tighter cost control",
    color: "#64748b",
    revenueGrowth: 0.02,
    expenseGrowth: 0.015,
    marketingIncrease: 0,
  },
  {
    id: "baseline",
    name: "Baseline",
    description: "Moderate growth under current conditions",
    color: "#3b82f6",
    revenueGrowth: 0.05,
    expenseGrowth: 0.03,
    marketingIncrease: 0,
  },
  {
    id: "optimistic",
    name: "Optimistic",
    description: "Stronger demand and improved operations",
    color: "#10b981",
    revenueGrowth: 0.09,
    expenseGrowth: 0.045,
    marketingIncrease: 5000,
  },
  {
    id: "aggressive",
    name: "Aggressive growth",
    description: "Faster expansion with higher spending",
    color: "#8b5cf6",
    revenueGrowth: 0.15,
    expenseGrowth: 0.09,
    marketingIncrease: 12000,
  },
];

const CURRENCY = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function money(value: number) {
  return CURRENCY.format(Number.isFinite(value) ? value : 0);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }

  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }

  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return money(value);
}

function readNumber(
  data: BusinessData,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const raw = data[key];

    if (raw === null || raw === undefined || raw === "") continue;

    const value =
      typeof raw === "number"
        ? raw
        : Number(String(raw).replace(/[₹,\s]/g, ""));

    if (Number.isFinite(value) && value >= 0) return value;
  }

  return fallback;
}

function readString(
  data: BusinessData,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function projectScenario(
  scenario: Scenario,
  revenue: number,
  expenses: number,
  horizon: number,
): ForecastResult {
  const months: ForecastMonth[] = [];

  for (let month = 1; month <= horizon; month++) {
    const projectedRevenue =
      revenue * Math.pow(1 + scenario.revenueGrowth, month);

    const projectedExpenses =
      expenses * Math.pow(1 + scenario.expenseGrowth, month) +
      scenario.marketingIncrease;

    const profit = projectedRevenue - projectedExpenses;

    months.push({
      month,
      revenue: projectedRevenue,
      expenses: projectedExpenses,
      profit,
      margin:
        projectedRevenue > 0
          ? (profit / projectedRevenue) * 100
          : 0,
    });
  }

  return { scenario, months };
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="forecast-stat">
      <div className="forecast-stat-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function ForecastPage() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("Your business");
  const [businessData, setBusinessData] = useState<BusinessData>({});
  const [profileData, setProfileData] = useState<BusinessData>({});
  const [horizon, setHorizon] = useState(12);
  const [selectedScenario, setSelectedScenario] = useState("baseline");
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [error, setError] = useState("");

  const loadBusiness = useCallback(async () => {
    setLoadingBusiness(true);
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

      if (profileResult.error) {
        console.warn(
          "Profile data could not be loaded:",
          profileResult.error.message,
        );
      }

      const business = (businessResult.data ?? {}) as BusinessData;
      const profile = (profileResult.data ?? {}) as BusinessData;

      if (!businessResult.data) {
        router.replace("/onboarding");
        return;
      }

      setBusinessData(business);
      setProfileData(profile);

      setBusinessName(
        readString(
          business,
          ["name", "business_name", "company_name"],
          readString(
            profile,
            ["business_name", "company_name"],
            "Your business",
          ),
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your business data.",
      );
    } finally {
      setLoadingBusiness(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBusiness();
  }, [loadBusiness]);

  const financials = useMemo(() => {
    // Business fields take priority when available; otherwise use profile fields.
    const merged = { ...profileData, ...businessData };

    const revenue = readNumber(merged, [
      "monthly_revenue",
      "monthlyRevenue",
      "revenue",
      "monthly_sales",
      "monthly_sales_amount",
    ]);

    const expenses = readNumber(merged, [
      "monthly_expenses",
      "monthlyExpenses",
      "expenses",
      "monthly_costs",
      "monthly_operating_costs",
    ]);

    const marketing = readNumber(merged, [
      "monthly_marketing_spend",
      "marketing_spend",
      "monthly_marketing_budget",
    ]);

    return {
      revenue,
      expenses,
      marketing,
      profit: revenue - expenses,
      margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
    };
  }, [businessData, profileData]);

  const forecasts = useMemo(
    () =>
      SCENARIOS.map((scenario) =>
        projectScenario(
          scenario,
          financials.revenue,
          financials.expenses,
          horizon,
        ),
      ),
    [financials, horizon],
  );

  const selectedForecast =
    forecasts.find((item) => item.scenario.id === selectedScenario) ??
    forecasts[1];

  const baselineForecast =
    forecasts.find((item) => item.scenario.id === "baseline") ??
    forecasts[1];

  const selectedFinal =
    selectedForecast.months[selectedForecast.months.length - 1];

  const baselineFinal =
    baselineForecast.months[baselineForecast.months.length - 1];

  const hasFinancialData =
    financials.revenue > 0 || financials.expenses > 0;

  async function generateAIAnalysis() {
    setLoadingAI(true);
    setError("");
    setAiAnalysis("");

    try {
      const scenarioSummary = forecasts
        .map((forecast) => {
          const finalMonth =
            forecast.months[forecast.months.length - 1];

          return {
            scenario: forecast.scenario.name,
            assumedMonthlyRevenueGrowth:
              `${(forecast.scenario.revenueGrowth * 100).toFixed(1)}%`,
            assumedMonthlyExpenseGrowth:
              `${(forecast.scenario.expenseGrowth * 100).toFixed(1)}%`,
            additionalMonthlyMarketingBudget:
              forecast.scenario.marketingIncrease,
            projectedRevenueAtHorizon: Math.round(finalMonth.revenue),
            projectedExpensesAtHorizon: Math.round(finalMonth.expenses),
            projectedProfitAtHorizon: Math.round(finalMonth.profit),
            projectedProfitMargin:
              `${finalMonth.margin.toFixed(1)}%`,
          };
        });

      const prompt = `
You are TwinIT's business forecasting analyst for "${businessName}".

Analyze these business figures and four deterministic scenario simulations.

CURRENT MONTHLY FIGURES:
- Revenue: ${financials.revenue} INR
- Expenses: ${financials.expenses} INR
- Profit: ${financials.profit} INR
- Profit margin: ${financials.margin.toFixed(2)}%
- Existing monthly marketing spend: ${financials.marketing} INR

FORECAST HORIZON: ${horizon} months.

SCENARIO RESULTS (INR):
${JSON.stringify(scenarioSummary, null, 2)}

IMPORTANT:
1. These are assumption-based scenarios, not trained statistical forecasts.
2. The growth rates are hypothetical inputs, not measured probabilities or verified market predictions.
3. Do not invent historical data, customer counts, demand, market size, or probabilities.
4. Explain which scenario appears financially attractive and why.
5. Highlight risks of aggressive growth, especially costs growing faster than revenue.
6. Give three practical actions and the KPIs the business should monitor.
7. Identify what additional historical data would make the forecasts more reliable.
8. Mention that revenue and expenses compound monthly under the assumptions.
9. Be specific to a small business in India. Use INR.
10. Do not merely repeat the numbers. Interpret the trade-offs and recommend a cautious next step.
11. Use Markdown headings, concise bullet lists, and a short comparison table.
12. If the starting figures are zero or incomplete, clearly explain the limitations.

Return a useful, concise decision report.
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
          result.error || "The AI analyst could not generate a report.",
        );
      }

      if (!result.answer) {
        throw new Error("The AI analyst returned an empty response.");
      }

      setAiAnalysis(result.answer);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate the AI forecast analysis.",
      );
    } finally {
      setLoadingAI(false);
    }
  }

  function downloadCSV() {
    const rows = [
      [
        "Scenario",
        "Month",
        "Projected Revenue INR",
        "Projected Expenses INR",
        "Projected Profit INR",
        "Profit Margin %",
        "Assumed Monthly Revenue Growth %",
        "Assumed Monthly Expense Growth %",
        "Additional Monthly Marketing INR",
      ],
    ];

    for (const forecast of forecasts) {
      for (const month of forecast.months) {
        rows.push([
          forecast.scenario.name,
          String(month.month),
          String(Math.round(month.revenue)),
          String(Math.round(month.expenses)),
          String(Math.round(month.profit)),
          month.margin.toFixed(2),
          String(forecast.scenario.revenueGrowth * 100),
          String(forecast.scenario.expenseGrowth * 100),
          String(forecast.scenario.marketingIncrease),
        ]);
      }
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${value.replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "twinit-scenario-forecasts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxChartValue = Math.max(
    1,
    ...forecasts.flatMap((forecast) =>
      forecast.months.map((month) => month.revenue),
    ),
  );

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / FORECASTS</span>
            <h1>Business forecasts</h1>
          </div>

          <div className="topbar-actions">
            <span className="date-pill">
              <span className="status-dot" />
              Scenario simulator
            </span>

            <button
              className="small-outline"
              onClick={() => void loadBusiness()}
              disabled={loadingBusiness}
            >
              <RefreshCw size={14} />
              Refresh data
            </button>
          </div>
        </header>

        <div className="page-content forecast-page">
          <section className="feature-hero forecast-hero">
            <div className="feature-hero-icon">
              <ChartNoAxesCombined size={24} />
            </div>

            <div>
              <span className="section-kicker">
                WHAT-IF BUSINESS PLANNING
              </span>
              <h2>Explore multiple possible futures.</h2>
              <p>
                Compare how different growth rates, operating costs and
                marketing budgets could affect {businessName}.
              </p>
            </div>
          </section>

          {error && (
            <div className="forecast-error" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {loadingBusiness ? (
            <div className="panel forecast-loading">
              <LoaderCircle className="forecast-spin" size={24} />
              <p>Loading your business financials…</p>
            </div>
          ) : (
            <>
              {!hasFinancialData && (
                <div className="forecast-warning">
                  <CircleAlert size={19} />
                  <div>
                    <strong>Financial data is incomplete</strong>
                    <p>
                      Revenue and expenses were not found in the expected
                      profile fields. Check your Supabase column names and
                      onboarding form. The projections below will be limited
                      until the starting values are correct.
                    </p>
                  </div>
                </div>
              )}

              <section className="forecast-section">
                <div className="forecast-section-heading">
                  <div>
                    <span className="section-kicker">STARTING POSITION</span>
                    <h2>Your current financial baseline</h2>
                    <p>
                      Monthly figures loaded from your saved business data.
                    </p>
                  </div>
                </div>

                <div className="forecast-stats-grid">
                  <StatCard
                    label="Monthly revenue"
                    value={money(financials.revenue)}
                    detail="Current baseline"
                    icon={ChartNoAxesCombined}
                  />

                  <StatCard
                    label="Monthly expenses"
                    value={money(financials.expenses)}
                    detail="Current baseline"
                    icon={Wallet}
                  />

                  <StatCard
                    label="Monthly profit"
                    value={money(financials.profit)}
                    detail="Revenue minus expenses"
                    icon={TrendingUp}
                  />

                  <StatCard
                    label="Profit margin"
                    value={`${financials.margin.toFixed(1)}%`}
                    detail="Based on current figures"
                    icon={BrainCircuit}
                  />
                </div>
              </section>

              <section className="panel forecast-controls">
                <div>
                  <span className="section-kicker">SIMULATION SETTINGS</span>
                  <h2>Choose your planning horizon</h2>
                  <p>
                    Compare alternative assumptions over the same period.
                  </p>
                </div>

                <div className="forecast-horizon-controls">
                  <label htmlFor="forecast-horizon">
                    <CalendarDays size={16} />
                    Forecast duration
                  </label>

                  <select
                    id="forecast-horizon"
                    value={horizon}
                    onChange={(event) => {
                      setHorizon(Number(event.target.value));
                      setAiAnalysis("");
                    }}
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>
              </section>

              <section className="forecast-section">
                <div className="forecast-section-heading">
                  <div>
                    <span className="section-kicker">FOUR POSSIBLE FUTURES</span>
                    <h2>Compare business scenarios</h2>
                    <p>
                      Select a scenario to inspect its projected financial
                      performance.
                    </p>
                  </div>
                </div>

                <div className="forecast-scenario-grid">
                  {forecasts.map((forecast) => {
                    const finalMonth =
                      forecast.months[forecast.months.length - 1];

                    const selected =
                      selectedScenario === forecast.scenario.id;

                    return (
                      <button
                        type="button"
                        key={forecast.scenario.id}
                        className={`forecast-scenario-card ${
                          selected ? "selected" : ""
                        }`}
                        onClick={() => setSelectedScenario(forecast.scenario.id)}
                        style={
                          {
                            "--scenario-color": forecast.scenario.color,
                          } as React.CSSProperties
                        }
                      >
                        <span className="scenario-card-top">
                          <span className="scenario-dot" />
                          <span>{forecast.scenario.name}</span>
                          {selected && <span className="scenario-selected">Selected</span>}
                        </span>

                        <strong>{money(finalMonth.profit)}</strong>
                        <small>Projected monthly profit at month {horizon}</small>

                        <span className="scenario-detail">
                          Revenue: {compactMoney(finalMonth.revenue)}
                        </span>
                        <span className="scenario-detail">
                          Expenses: {compactMoney(finalMonth.expenses)}
                        </span>
                        <span className="scenario-description">
                          {forecast.scenario.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="forecast-assumption-note">
                  <CircleAlert size={16} />
                  <span>
                    These scenarios use hypothetical monthly growth rates:
                    conservative 2%, baseline 5%, optimistic 9%, and
                    aggressive 15% revenue growth. Expense growth and additional
                    marketing spending also differ by scenario. They are
                    planning assumptions, not probabilities or verified
                    predictions.
                  </span>
                </div>
              </section>

              <section className="panel forecast-chart-panel">
                <div className="forecast-section-heading">
                  <div>
                    <span className="section-kicker">REVENUE TRAJECTORY</span>
                    <h2>How revenue could evolve</h2>
                    <p>
                      Monthly revenue projections across all four scenarios.
                    </p>
                  </div>

                  <button
                    className="small-outline"
                    onClick={downloadCSV}
                  >
                    Download CSV
                  </button>
                </div>

                <div className="forecast-chart">
                  {forecasts.map((forecast) => (
                    <div className="forecast-chart-row" key={forecast.scenario.id}>
                      <div className="forecast-chart-label">
                        <span
                          className="scenario-dot"
                          style={{
                            background: forecast.scenario.color,
                          }}
                        />
                        <span>{forecast.scenario.name}</span>
                        <strong>
                          {compactMoney(
                            forecast.months[forecast.months.length - 1].revenue,
                          )}
                        </strong>
                      </div>

                      <div className="forecast-track">
                        <div
                          className="forecast-bar"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                (forecast.months[forecast.months.length - 1]
                                  .revenue /
                                  maxChartValue) *
                                  100,
                              ),
                            )}%`,
                            background: forecast.scenario.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="forecast-month-grid">
                  {selectedForecast.months.map((month) => (
                    <div className="forecast-month-card" key={month.month}>
                      <span>Month {month.month}</span>
                      <strong>{compactMoney(month.revenue)}</strong>
                      <small>Revenue</small>
                      <strong
                        className={
                          month.profit >= 0
                            ? "forecast-positive"
                            : "forecast-negative"
                        }
                      >
                        {compactMoney(month.profit)}
                      </strong>
                      <small>Profit</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel forecast-detail-panel">
                <div className="forecast-section-heading">
                  <div>
                    <span className="section-kicker">SCENARIO DETAILS</span>
                    <h2>{selectedForecast.scenario.name} scenario</h2>
                    <p>{selectedForecast.scenario.description}</p>
                  </div>
                </div>

                <div className="forecast-assumption-grid">
                  <div>
                    <span>Assumed monthly revenue growth</span>
                    <strong>
                      +{(
                        selectedForecast.scenario.revenueGrowth * 100
                      ).toFixed(1)}%
                    </strong>
                  </div>

                  <div>
                    <span>Assumed monthly expense growth</span>
                    <strong>
                      +{(
                        selectedForecast.scenario.expenseGrowth * 100
                      ).toFixed(1)}%
                    </strong>
                  </div>

                  <div>
                    <span>Extra monthly marketing budget</span>
                    <strong>
                      {money(selectedForecast.scenario.marketingIncrease)}
                    </strong>
                  </div>

                  <div>
                    <span>Projected profit margin at month {horizon}</span>
                    <strong>{selectedFinal.margin.toFixed(1)}%</strong>
                  </div>
                </div>

                <div className="forecast-table-wrap">
                  <table className="forecast-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        <th>Expenses</th>
                        <th>Profit / loss</th>
                        <th>Margin</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>Current</td>
                        <td>{money(financials.revenue)}</td>
                        <td>{money(financials.expenses)}</td>
                        <td>{money(financials.profit)}</td>
                        <td>{financials.margin.toFixed(1)}%</td>
                      </tr>

                      {selectedForecast.months.map((month) => (
                        <tr key={month.month}>
                          <td>Month {month.month}</td>
                          <td>{money(month.revenue)}</td>
                          <td>{money(month.expenses)}</td>
                          <td
                            className={
                              month.profit >= 0
                                ? "forecast-positive"
                                : "forecast-negative"
                            }
                          >
                            {money(month.profit)}
                          </td>
                          <td>{month.margin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel forecast-ai-panel">
                <div className="forecast-ai-heading">
                  <div className="forecast-ai-icon">
                    <Bot size={22} />
                  </div>

                  <div>
                    <span className="section-kicker">GROQ AI ANALYST</span>
                    <h2>Turn scenarios into a decision</h2>
                    <p>
                      Ask the AI to interpret the numbers, identify risks,
                      and suggest practical next steps.
                    </p>
                  </div>
                </div>

                <div className="forecast-ai-context">
                  <span>
                    Selected scenario: <strong>{selectedForecast.scenario.name}</strong>
                  </span>
                  <span>
                    {horizon}-month projected profit:{" "}
                    <strong>{money(selectedFinal.profit)}</strong>
                  </span>
                  <span>
                    Baseline scenario profit:{" "}
                    <strong>{money(baselineFinal.profit)}</strong>
                  </span>
                </div>

                <button
                  className="forecast-ai-button"
                  onClick={() => void generateAIAnalysis()}
                  disabled={loadingAI || loadingBusiness}
                >
                  {loadingAI ? (
                    <LoaderCircle className="forecast-spin" size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}

                  {loadingAI
                    ? "Analyzing scenarios…"
                    : "Generate AI forecast analysis"}
                </button>

                {aiAnalysis && (
                  <div className="forecast-ai-report">
                    <div className="forecast-ai-report-heading">
                      <Sparkles size={17} />
                      <strong>AI decision report</strong>
                    </div>

                    <div className="forecast-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {aiAnalysis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </section>

              <section className="forecast-section">
                <div className="forecast-section-heading">
                  <div>
                    <span className="section-kicker">DECISION CHECKLIST</span>
                    <h2>Before acting on a forecast</h2>
                  </div>
                </div>

                <div className="forecast-checklist-grid">
                  <div>
                    <ArrowUpRight size={19} />
                    <strong>Validate demand</strong>
                    <p>
                      Check whether sales volumes can support the assumed
                      revenue growth.
                    </p>
                  </div>

                  <div>
                    <ArrowDownRight size={19} />
                    <strong>Watch cost growth</strong>
                    <p>
                      Compare actual expenses with the scenario each month.
                    </p>
                  </div>

                  <div>
                    <ChartNoAxesCombined size={19} />
                    <strong>Track actual results</strong>
                    <p>
                      Record dated sales, expenses, stock, returns and
                      marketing outcomes.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}

          <footer className="page-footer">
            TwinIT <span>·</span> Simulate smarter. Decide better.
            <span className="footer-right">
              Scenario-based estimates · Not guaranteed outcomes
            </span>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .forecast-page {
          --forecast-border: #e2e8f0;
          --forecast-muted: #64748b;
          --forecast-text: #0f172a;
        }

        .forecast-section {
          margin: 1.8rem 0;
        }

        .forecast-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .forecast-section-heading h2,
        .forecast-controls h2,
        .forecast-ai-panel h2 {
          margin: 0.35rem 0;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .forecast-section-heading p,
        .forecast-controls p,
        .forecast-ai-heading p {
          margin: 0.35rem 0 0;
          color: var(--forecast-muted);
          font-size: 0.88rem;
          line-height: 1.6;
        }

        .forecast-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .forecast-stat {
          min-width: 0;
          padding: 1.15rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.85rem;
          background: white;
        }

        .forecast-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          color: var(--forecast-muted);
          font-size: 0.8rem;
        }

        .forecast-stat-top svg {
          flex-shrink: 0;
        }

        .forecast-stat > strong {
          display: block;
          margin-top: 1rem;
          color: var(--forecast-text);
          font-size: clamp(1.15rem, 2vw, 1.65rem);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .forecast-stat > small {
          display: block;
          margin-top: 0.45rem;
          color: var(--forecast-muted);
          font-size: 0.75rem;
        }

        .forecast-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
          padding: 1.25rem;
        }

        .forecast-horizon-controls {
          display: grid;
          gap: 0.45rem;
          min-width: 180px;
        }

        .forecast-horizon-controls label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .forecast-horizon-controls select {
          width: 100%;
          padding: 0.7rem 0.8rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.55rem;
          background: white;
          color: var(--forecast-text);
        }

        .forecast-scenario-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .forecast-scenario-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.65rem;
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.85rem;
          background: white;
          text-align: left;
          cursor: pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .forecast-scenario-card:hover,
        .forecast-scenario-card.selected {
          border-color: var(--scenario-color);
          box-shadow: 0 0 0 1px var(--scenario-color);
        }

        .scenario-card-top {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.45rem;
          color: var(--forecast-text);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .scenario-dot {
          display: inline-block;
          width: 9px;
          height: 9px;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--scenario-color, #64748b);
        }

        .scenario-selected {
          color: var(--forecast-muted);
          font-size: 0.68rem;
          font-weight: 500;
        }

        .forecast-scenario-card > strong {
          margin-top: 0.5rem;
          font-size: clamp(1.1rem, 2vw, 1.45rem);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .forecast-scenario-card > small {
          color: var(--forecast-muted);
          font-size: 0.74rem;
          line-height: 1.5;
        }

        .scenario-detail {
          color: var(--forecast-text);
          font-size: 0.78rem;
          overflow-wrap: anywhere;
        }

        .scenario-description {
          margin-top: 0.3rem;
          color: var(--forecast-muted);
          font-size: 0.76rem;
          line-height: 1.5;
        }

        .forecast-assumption-note,
        .forecast-warning,
        .forecast-error {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          margin-top: 1rem;
          padding: 0.9rem 1rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.65rem;
          color: var(--forecast-muted);
          font-size: 0.82rem;
          line-height: 1.65;
        }

        .forecast-assumption-note svg,
        .forecast-warning svg,
        .forecast-error svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .forecast-warning {
          border-color: #fcd34d;
          background: #fffbeb;
          color: #92400e;
        }

        .forecast-warning strong {
          display: block;
          margin-bottom: 0.2rem;
        }

        .forecast-warning p {
          margin: 0;
        }

        .forecast-error {
          border-color: #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .forecast-chart-panel,
        .forecast-detail-panel,
        .forecast-ai-panel {
          padding: 1.25rem;
        }

        .forecast-chart {
          display: grid;
          gap: 1.15rem;
          margin: 1.4rem 0;
        }

        .forecast-chart-row {
          display: grid;
          gap: 0.5rem;
        }

        .forecast-chart-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }

        .forecast-chart-label strong {
          margin-left: auto;
          font-variant-numeric: tabular-nums;
        }

        .forecast-track {
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: #f1f5f9;
        }

        .forecast-bar {
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
          transition: width 200ms ease;
        }

        .forecast-month-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
          margin-top: 1.5rem;
        }

        .forecast-month-card {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.65rem;
          background: #fff;
        }

        .forecast-month-card > span,
        .forecast-month-card > small {
          color: var(--forecast-muted);
          font-size: 0.72rem;
        }

        .forecast-month-card > strong {
          font-size: 0.9rem;
          overflow-wrap: anywhere;
        }

        .forecast-positive {
          color: #047857 !important;
        }

        .forecast-negative {
          color: #b91c1c !important;
        }

        .forecast-assumption-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.8rem;
          margin: 1.25rem 0;
        }

        .forecast-assumption-grid > div {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.9rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.65rem;
        }

        .forecast-assumption-grid span {
          color: var(--forecast-muted);
          font-size: 0.76rem;
          line-height: 1.5;
        }

        .forecast-assumption-grid strong {
          font-size: 1rem;
          overflow-wrap: anywhere;
        }

        .forecast-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--forecast-border);
          border-radius: 0.65rem;
        }

        .forecast-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.8rem;
        }

        .forecast-table th,
        .forecast-table td {
          padding: 0.8rem;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .forecast-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
        }

        .forecast-table tbody tr:last-child td {
          border-bottom: none;
        }

        .forecast-ai-heading {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .forecast-ai-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 0.7rem;
          background: #eff6ff;
          color: #2563eb;
        }

        .forecast-ai-context {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          margin: 1.2rem 0;
        }

        .forecast-ai-context > span {
          padding: 0.5rem 0.7rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.5rem;
          font-size: 0.77rem;
          line-height: 1.5;
        }

        .forecast-ai-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          padding: 0.8rem 1rem;
          border: none;
          border-radius: 0.6rem;
          background: #0f172a;
          color: white;
          font-size: 0.85rem;
          font-weight: 650;
          cursor: pointer;
        }

        .forecast-ai-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .forecast-ai-report {
          margin-top: 1.25rem;
          padding: 1.1rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.75rem;
          background: #fff;
        }

        .forecast-ai-report-heading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-bottom: 0.8rem;
          border-bottom: 1px solid var(--forecast-border);
        }

        .forecast-markdown {
          margin-top: 0.75rem;
          overflow-wrap: anywhere;
          font-size: 0.9rem;
          line-height: 1.75;
        }

        .forecast-markdown h1,
        .forecast-markdown h2,
        .forecast-markdown h3 {
          margin: 1rem 0 0.45rem;
          font-weight: 700;
          line-height: 1.4;
        }

        .forecast-markdown h1 {
          font-size: 1.3rem;
        }

        .forecast-markdown h2 {
          font-size: 1.1rem;
        }

        .forecast-markdown h3 {
          font-size: 0.98rem;
        }

        .forecast-markdown p {
          margin: 0.6rem 0;
        }

        .forecast-markdown ul,
        .forecast-markdown ol {
          margin: 0.6rem 0;
          padding-left: 1.5rem;
        }

        .forecast-markdown ul {
          list-style: disc;
        }

        .forecast-markdown ol {
          list-style: decimal;
        }

        .forecast-markdown li {
          margin: 0.25rem 0;
        }

        .forecast-markdown strong {
          font-weight: 700;
        }

        .forecast-markdown table {
          width: 100%;
          margin: 0.8rem 0;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .forecast-markdown th,
        .forecast-markdown td {
          padding: 0.6rem;
          border: 1px solid var(--forecast-border);
          text-align: left;
        }

        .forecast-markdown th {
          background: #f8fafc;
        }

        .forecast-markdown blockquote {
          margin: 0.8rem 0;
          padding-left: 0.8rem;
          border-left: 3px solid #cbd5e1;
          color: var(--forecast-muted);
        }

        .forecast-checklist-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .forecast-checklist-grid > div {
          padding: 1rem;
          border: 1px solid var(--forecast-border);
          border-radius: 0.75rem;
          background: white;
        }

        .forecast-checklist-grid svg {
          margin-bottom: 0.7rem;
        }

        .forecast-checklist-grid strong {
          display: block;
          font-size: 0.9rem;
        }

        .forecast-checklist-grid p {
          margin: 0.5rem 0 0;
          color: var(--forecast-muted);
          font-size: 0.8rem;
          line-height: 1.65;
        }

        .forecast-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 0.8rem;
          min-height: 220px;
        }

        .forecast-loading p {
          color: var(--forecast-muted);
        }

        .forecast-spin {
          animation: forecast-spin 1s linear infinite;
        }

        @keyframes forecast-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .forecast-stats-grid,
          .forecast-scenario-grid,
          .forecast-assumption-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .forecast-month-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .forecast-stats-grid,
          .forecast-scenario-grid,
          .forecast-assumption-grid,
          .forecast-checklist-grid {
            grid-template-columns: 1fr;
          }

          .forecast-controls {
            align-items: stretch;
            flex-direction: column;
          }

          .forecast-horizon-controls {
            min-width: 0;
          }

          .forecast-month-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .forecast-chart-panel,
          .forecast-detail-panel,
          .forecast-ai-panel {
            padding: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}
