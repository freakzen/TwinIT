"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Boxes,
  ChartNoAxesCombined,
  CircleAlert,
  FlaskConical,
  LoaderCircle,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

type DataRecord = Record<string, unknown>;

type SimulationInputs = {
  priceChange: number;
  demandChange: number;
  marketingSpend: number;
  marketingEffectiveness: number;
  variableCostChange: number;
  fixedCostChange: number;
  staffingCost: number;
  inventoryBudget: number;
  horizon: number;
};

type BusinessBaseline = {
  name: string;
  revenue: number;
  expenses: number;
  marketing: number;
  products: number;
  customersPerDay: number;
  averageOrderValue: number;
  employees: number;
};

type SimulationResult = {
  revenue: number;
  variableCosts: number;
  fixedCosts: number;
  marketing: number;
  staffing: number;
  inventory: number;
  expenses: number;
  profit: number;
  margin: number;
  breakEvenRevenue: number;
  changeInProfit: number;
  revenueChange: number;
};

type Experiment = {
  id: string;
  name: string;
  inputs: SimulationInputs;
  result: SimulationResult;
};

const DEFAULT_INPUTS: SimulationInputs = {
  priceChange: 0,
  demandChange: 0,
  marketingSpend: 0,
  marketingEffectiveness: 1.5,
  variableCostChange: 0,
  fixedCostChange: 0,
  staffingCost: 0,
  inventoryBudget: 0,
  horizon: 12,
};

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
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return money(value);
}

function numeric(
  data: DataRecord,
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

function textValue(
  data: DataRecord,
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Transparent assumption-based financial model.
 *
 * Price and demand changes are combined to estimate revenue.
 * Marketing adds an explicitly assumed demand uplift.
 * Variable costs scale with estimated revenue.
 * Fixed expenses are separated from variable costs using an assumption.
 *
 * Replace these assumptions with calibrated business-specific parameters
 * when enough historical data becomes available.
 */
function simulate(
  baseline: BusinessBaseline,
  inputs: SimulationInputs,
): SimulationResult {
  const revenue = baseline.revenue;
  const expenses = baseline.expenses;
  const marketing = baseline.marketing;

  const priceMultiplier = 1 + inputs.priceChange / 100;

  // A price increase may reduce demand; a price reduction may increase it.
  // This is a configurable illustrative elasticity assumption, not a learned value.
  const assumedPriceElasticity = 1.2;
  const priceDrivenDemandMultiplier = Math.max(
    0,
    1 - (inputs.priceChange / 100) * assumedPriceElasticity,
  );

  const marketingBase = Math.max(marketing, 0);
  const marketingTotal = marketingBase + inputs.marketingSpend;

  // Effectiveness is an assumed incremental revenue response per ₹1 spent.
  // Diminishing returns are applied to avoid unlimited linear growth.
  const marketingRatio =
    marketingTotal > 0
      ? (inputs.marketingEffectiveness *
          inputs.marketingSpend) /
        (marketingTotal + inputs.marketingSpend + 1)
      : 0;

  const marketingDemandUplift =
    inputs.marketingSpend > 0
      ? Math.min(0.5, marketingRatio)
      : 0;

  const demandMultiplier =
    Math.max(0, 1 + inputs.demandChange / 100) *
    priceDrivenDemandMultiplier *
    (1 + marketingDemandUplift);

  const newRevenue =
    revenue *
    priceMultiplier *
    demandMultiplier;

  // This split is an assumption until the business records real cost breakdowns.
  const assumedVariableCostShare =
    expenses > 0 ? 0.6 : 0;

  const currentVariableCosts = expenses * assumedVariableCostShare;
  const currentFixedCosts = expenses - currentVariableCosts;

  const variableCosts =
    currentVariableCosts *
    Math.max(0, newRevenue / Math.max(revenue, 1)) *
    (1 + inputs.variableCostChange / 100);

  const fixedCosts =
    currentFixedCosts * (1 + inputs.fixedCostChange / 100);

  const staffing = inputs.staffingCost;
  const inventory = inputs.inventoryBudget;

  // Inventory budget is treated as an incremental cash outlay for this
  // simple model. It is not automatically treated as a fully consumed expense.
  const totalExpenses =
    variableCosts +
    fixedCosts +
    marketingTotal +
    staffing;

  const profit = newRevenue - totalExpenses;

  // Break-even revenue uses the modeled variable-cost ratio.
  const variableCostRatio =
    newRevenue > 0 ? variableCosts / newRevenue : 0;

  const breakEvenRevenue =
    variableCostRatio < 1
      ? (fixedCosts + marketingTotal + staffing) /
        (1 - variableCostRatio)
      : 0;

  const horizon = inputs.horizon;

  // These figures assume the simulated month repeats unchanged.
  // They are not a time-series forecast.
  const cumulativeProfit = profit * horizon;

  return {
    revenue: newRevenue,
    variableCosts,
    fixedCosts,
    marketing: marketingTotal,
    staffing,
    inventory,
    expenses: totalExpenses,
    profit,
    margin: newRevenue > 0 ? (profit / newRevenue) * 100 : 0,
    breakEvenRevenue,
    changeInProfit: profit - (revenue - expenses - marketingBase),
    revenueChange:
      revenue > 0 ? ((newRevenue - revenue) / revenue) * 100 : 0,
  };
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "%",
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="sim-field">
      <div className="sim-field-header">
        <label>{label}</label>
        <strong>
          {value > 0 && unit === "%" ? "+" : ""}
          {value}
          {unit}
        </strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="sim-range-labels">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      <p>{description}</p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  max,
  description,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  description: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="sim-field">
      <div className="sim-field-header">
        <label>{label}</label>
        <strong>{money(value)}</strong>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={500}
        value={Math.min(value, max)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="sim-range-labels">
        <span>₹0</span>
        <span>{compactMoney(max)}</span>
      </div>
      <p>{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  positive,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Wallet;
  positive?: boolean;
}) {
  return (
    <div className="sim-metric">
      <div className="sim-metric-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong className={positive === false ? "sim-negative" : ""}>
        {value}
      </strong>
      <small>{detail}</small>
    </div>
  );
}

export default function SimulationLabPage() {
  const router = useRouter();

  const [business, setBusiness] = useState<BusinessBaseline>({
    name: "Your business",
    revenue: 0,
    expenses: 0,
    marketing: 0,
    products: 0,
    customersPerDay: 0,
    averageOrderValue: 0,
    employees: 0,
  });

  const [inputs, setInputs] = useState<SimulationInputs>(DEFAULT_INPUTS);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentName, setExperimentName] = useState("Experiment 1");
  const [hasRun, setHasRun] = useState(false);

  const updateInput = <K extends keyof SimulationInputs>(
    key: K,
    value: SimulationInputs[K],
  ) => {
    setInputs((previous) => ({ ...previous, [key]: value }));
    setAiReport("");
  };

  const loadBusiness = useCallback(async () => {
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

      const businessRecord =
        (businessResult.data ?? {}) as DataRecord;

      const profileRecord =
        (profileResult.data ?? {}) as DataRecord;

      if (!businessResult.data) {
        router.replace("/onboarding");
        return;
      }

      const combined = {
        ...profileRecord,
        ...businessRecord,
      };

      setBusiness({
        name: textValue(
          combined,
          ["name", "business_name", "company_name"],
          "Your business",
        ),
        revenue: numeric(combined, [
          "monthly_revenue",
          "monthlyRevenue",
          "revenue",
          "monthly_sales",
          "monthly_sales_amount",
        ]),
        expenses: numeric(combined, [
          "monthly_expenses",
          "monthlyExpenses",
          "expenses",
          "monthly_costs",
          "monthly_operating_costs",
        ]),
        marketing: numeric(combined, [
          "monthly_marketing_spend",
          "marketing_spend",
          "monthly_marketing_budget",
        ]),
        products: numeric(combined, [
          "product_count",
          "total_products",
          "products_count",
        ]),
        customersPerDay: numeric(combined, [
          "customers_per_day",
          "daily_customers",
          "customers_daily",
        ]),
        averageOrderValue: numeric(combined, [
          "average_order_value",
          "averageOrderValue",
          "aov",
        ]),
        employees: numeric(combined, [
          "employees",
          "employee_count",
          "number_of_employees",
        ]),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load business information.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadBusiness();
  }, [loadBusiness]);

  const result = useMemo(
    () => simulate(business, inputs),
    [business, inputs],
  );

  const baselineResult = useMemo(
    () => simulate(business, DEFAULT_INPUTS),
    [business],
  );

  const breakEvenGap =
    result.revenue - result.breakEvenRevenue;

  function runSimulation() {
    setRunning(true);
    setError("");

    // The engine is deterministic and runs locally; no AI call is needed
    // for numerical calculations.
    window.setTimeout(() => {
      setHasRun(true);
      setRunning(false);
    }, 150);
  }

  function resetSimulation() {
    setInputs(DEFAULT_INPUTS);
    setAiReport("");
    setHasRun(false);
    setError("");
  }

  function saveExperiment() {
    const name = experimentName.trim() || `Experiment ${experiments.length + 1}`;

    const experiment: Experiment = {
      id: `${Date.now()}-${experiments.length}`,
      name,
      inputs: { ...inputs },
      result: { ...result },
    };

    setExperiments((previous) => [...previous, experiment]);
    setExperimentName(`Experiment ${experiments.length + 2}`);
  }

  function loadExperiment(experiment: Experiment) {
    setInputs({ ...experiment.inputs });
    setAiReport("");
    setHasRun(true);
  }

  async function askGroq() {
    setAiLoading(true);
    setError("");
    setAiReport("");

    try {
      const prompt = `
You are TwinIT's virtual business simulation analyst.

Business: ${business.name}

CURRENT MONTHLY BASELINE:
Revenue: ${business.revenue} INR
Expenses: ${business.expenses} INR
Marketing spend: ${business.marketing} INR
Customers per day: ${business.customersPerDay}
Average order value: ${business.averageOrderValue} INR
Employees: ${business.employees}
Products: ${business.products}

USER'S SIMULATION INPUTS:
Price change: ${inputs.priceChange}%
Demand change: ${inputs.demandChange}%
Additional monthly marketing: ${inputs.marketingSpend} INR
Marketing effectiveness assumption: ${inputs.marketingEffectiveness}
Variable cost change: ${inputs.variableCostChange}%
Fixed cost change: ${inputs.fixedCostChange}%
Additional monthly staffing cost: ${inputs.staffingCost} INR
Additional inventory cash budget: ${inputs.inventoryBudget} INR
Planning horizon: ${inputs.horizon} months

CALCULATED SCENARIO RESULT:
Revenue: ${result.revenue} INR/month
Total modeled expenses: ${result.expenses} INR/month
Profit: ${result.profit} INR/month
Profit margin: ${result.margin.toFixed(2)}%
Break-even revenue estimate: ${result.breakEvenRevenue} INR/month
Revenue change versus baseline: ${result.revenueChange.toFixed(2)}%
Monthly profit difference versus baseline: ${result.changeInProfit} INR

BASELINE MODEL RESULT:
Revenue: ${baselineResult.revenue} INR/month
Modeled expenses: ${baselineResult.expenses} INR/month
Profit: ${baselineResult.profit} INR/month
Margin: ${baselineResult.margin.toFixed(2)}%

MODELING LIMITATIONS:
- Price elasticity is a hypothetical assumption, not learned from this business's sales.
- Marketing effectiveness is user-configurable and has not been validated against campaign outcomes.
- Expenses are split into variable and fixed portions using a 60/40 assumption.
- No verified transaction time series was supplied in this request.
- Inventory budget is a cash-planning input and is not counted as an immediate expense in the profit calculation.
- The selected horizon repeats the simulated monthly outcome; it is not a trained forecast.
- Results are model calculations, not guarantees.

Write a practical simulation report with:
1. What changed in the simulated business.
2. Baseline versus experiment comparison.
3. Financial upside and downside.
4. Important assumptions and failure risks.
5. Three actions to test next.
6. KPIs and thresholds to monitor.
7. What actual data would improve the model.

Do not fabricate historical data or claim the simulation is statistically validated.
Use INR, clear Markdown headings, bullet lists and a compact comparison table.
If baseline data is zero or incomplete, say so explicitly.
      `.trim();

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Groq could not analyze this experiment.",
        );
      }

      setAiReport(data.answer || "The AI returned an empty response.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI analysis failed. Please try again.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  const revenueBars = [
    { label: "Baseline", value: baselineResult.revenue, color: "#64748b" },
    { label: "Experiment", value: result.revenue, color: "#3b82f6" },
  ];

  const maxRevenue = Math.max(
    1,
    ...revenueBars.map((item) => item.value),
  );

  const hasBaseline =
    business.revenue > 0 || business.expenses > 0;

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / SIMULATION LAB</span>
            <h1>Virtual simulation lab</h1>
          </div>

          <div className="topbar-actions">
            <span className="date-pill">
              <span className="status-dot" />
              Interactive business twin
            </span>

            <button
              className="small-outline"
              onClick={() => void loadBusiness()}
              disabled={loading}
            >
              <Activity size={14} />
              Refresh data
            </button>
          </div>
        </header>

        <div className="page-content sim-page">
          <section className="feature-hero">
            <div className="feature-hero-icon">
              <FlaskConical size={25} />
            </div>

            <div>
              <span className="section-kicker">TWINIT VIRTUAL LAB</span>
              <h2>Experiment before you execute.</h2>
              <p>
                Change prices, demand, marketing and operating costs for{" "}
                {business.name}. Explore the modeled financial impact
                without changing your real business records.
              </p>
            </div>
          </section>

          {error && (
            <div className="sim-alert" role="alert">
              <CircleAlert size={17} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <section className="panel sim-loading">
              <LoaderCircle className="sim-spin" size={25} />
              <p>Building your virtual business model…</p>
            </section>
          ) : (
            <>
              {!hasBaseline && (
                <div className="sim-alert sim-alert-warning">
                  <CircleAlert size={18} />
                  <div>
                    <strong>Baseline financial data is incomplete.</strong>
                    <p>
                      Add your monthly revenue and expenses in onboarding
                      or your business profile for meaningful results.
                      The simulation can still be explored, but its outputs
                      will not be representative of your actual business.
                    </p>
                  </div>
                </div>
              )}

              <section className="sim-overview-grid">
                <div className="sim-overview-card">
                  <span>Virtual business</span>
                  <strong>{business.name}</strong>
                  <small>Based on your saved business profile</small>
                </div>

                <div className="sim-overview-card">
                  <span>Baseline monthly revenue</span>
                  <strong>{money(business.revenue)}</strong>
                  <small>Starting financial input</small>
                </div>

                <div className="sim-overview-card">
                  <span>Baseline monthly expenses</span>
                  <strong>{money(business.expenses)}</strong>
                  <small>Starting financial input</small>
                </div>

                <div className="sim-overview-card">
                  <span>Employees / products</span>
                  <strong>
                    {business.employees} / {business.products}
                  </strong>
                  <small>Profile values, if provided</small>
                </div>
              </section>

              <div className="sim-workspace">
                <section className="panel sim-control-panel">
                  <div className="sim-panel-heading">
                    <div className="sim-panel-icon">
                      <Settings2 size={19} />
                    </div>
                    <div>
                      <span className="section-kicker">CONTROL ROOM</span>
                      <h2>Configure your experiment</h2>
                      <p>
                        Change one variable at a time to understand its
                        modeled effect.
                      </p>
                    </div>
                  </div>

                  <div className="sim-controls-group">
                    <div className="sim-group-title">
                      <TrendingUp size={17} />
                      <h3>Market & pricing</h3>
                    </div>

                    <SliderField
                      label="Product price change"
                      value={inputs.priceChange}
                      min={-30}
                      max={30}
                      step={1}
                      description="Test price reductions or increases. Demand response uses a hypothetical elasticity assumption."
                      onChange={(value) => updateInput("priceChange", value)}
                    />

                    <SliderField
                      label="Demand change"
                      value={inputs.demandChange}
                      min={-50}
                      max={100}
                      step={5}
                      description="Simulate changes in sales volume from seasonality, demand or competition."
                      onChange={(value) => updateInput("demandChange", value)}
                    />
                  </div>

                  <div className="sim-controls-group">
                    <div className="sim-group-title">
                      <Sparkles size={17} />
                      <h3>Marketing</h3>
                    </div>

                    <MoneyField
                      label="Extra monthly marketing"
                      value={inputs.marketingSpend}
                      max={50000}
                      description="Test an additional marketing budget on top of current spend."
                      onChange={(value) =>
                        updateInput("marketingSpend", value)
                      }
                    />

                    <SliderField
                      label="Marketing effectiveness"
                      value={inputs.marketingEffectiveness}
                      min={0}
                      max={5}
                      step={0.25}
                      unit="x"
                      description="Illustrative response assumption. Calibrate using real campaign spend and sales data."
                      onChange={(value) =>
                        updateInput("marketingEffectiveness", value)
                      }
                    />
                  </div>

                  <div className="sim-controls-group">
                    <div className="sim-group-title">
                      <Wallet size={17} />
                      <h3>Operating costs</h3>
                    </div>

                    <SliderField
                      label="Variable cost change"
                      value={inputs.variableCostChange}
                      min={-30}
                      max={50}
                      step={5}
                      description="Model changes in purchase costs, materials, packaging or other volume-related costs."
                      onChange={(value) =>
                        updateInput("variableCostChange", value)
                      }
                    />

                    <SliderField
                      label="Fixed cost change"
                      value={inputs.fixedCostChange}
                      min={-30}
                      max={50}
                      step={5}
                      description="Model rent, utilities and other fixed operating cost changes."
                      onChange={(value) =>
                        updateInput("fixedCostChange", value)
                      }
                    />

                    <MoneyField
                      label="Additional monthly staffing"
                      value={inputs.staffingCost}
                      max={100000}
                      description="Include additional salary and staffing costs for expansion."
                      onChange={(value) =>
                        updateInput("staffingCost", value)
                      }
                    />

                    <MoneyField
                      label="Additional inventory budget"
                      value={inputs.inventoryBudget}
                      max={200000}
                      description="Cash planning input. Reported separately; not treated as an immediate expense."
                      onChange={(value) =>
                        updateInput("inventoryBudget", value)
                      }
                    />
                  </div>

                  <div className="sim-horizon-field">
                    <label htmlFor="sim-horizon">
                      <Activity size={16} />
                      Planning horizon
                    </label>

                    <select
                      id="sim-horizon"
                      value={inputs.horizon}
                      onChange={(event) =>
                        updateInput("horizon", Number(event.target.value))
                      }
                    >
                      <option value={1}>1 month</option>
                      <option value={3}>3 months</option>
                      <option value={6}>6 months</option>
                      <option value={12}>12 months</option>
                      <option value={24}>24 months</option>
                    </select>
                    <p>
                      The current model repeats the same monthly result.
                      It does not model seasonality or month-to-month
                      uncertainty.
                    </p>
                  </div>

                  <div className="sim-action-row">
                    <button
                      className="sim-run-button"
                      onClick={runSimulation}
                      disabled={running}
                    >
                      {running ? (
                        <LoaderCircle className="sim-spin" size={18} />
                      ) : (
                        <Play size={17} />
                      )}
                      Run simulation
                    </button>

                    <button
                      className="small-outline"
                      onClick={resetSimulation}
                    >
                      <RotateCcw size={15} />
                      Reset
                    </button>
                  </div>

                  <p className="sim-local-note">
                    Running the simulation updates modeled results only.
                    It does not modify your saved financial records.
                  </p>
                </section>

                <div className="sim-results-column">
                  <section className="panel sim-results-panel">
                    <div className="sim-panel-heading">
                      <div className="sim-panel-icon">
                        <ChartNoAxesCombined size={19} />
                      </div>
                      <div>
                        <span className="section-kicker">LIVE RESULTS</span>
                        <h2>Simulated business performance</h2>
                        <p>
                          {hasRun
                            ? "Simulation completed using your selected assumptions."
                            : "Results update as you adjust the controls."}
                        </p>
                      </div>
                    </div>

                    <div className="sim-metrics-grid">
                      <MetricCard
                        label="Simulated revenue"
                        value={money(result.revenue)}
                        detail={`${result.revenueChange >= 0 ? "+" : ""}${result.revenueChange.toFixed(1)}% vs baseline revenue`}
                        icon={ChartNoAxesCombined}
                      />

                      <MetricCard
                        label="Simulated expenses"
                        value={money(result.expenses)}
                        detail="Modeled monthly operating costs"
                        icon={Wallet}
                      />

                      <MetricCard
                        label="Simulated profit"
                        value={money(result.profit)}
                        detail={`${result.profit >= 0 ? "Positive" : "Negative"} monthly result`}
                        icon={TrendingUp}
                        positive={result.profit >= 0}
                      />

                      <MetricCard
                        label="Profit margin"
                        value={`${result.margin.toFixed(1)}%`}
                        detail="Profit as a share of revenue"
                        icon={BrainCircuit}
                        positive={result.margin >= 0}
                      />
                    </div>

                    <div className="sim-chart-title">
                      <h3>Revenue comparison</h3>
                      <span>Per month</span>
                    </div>

                    <div className="sim-revenue-chart">
                      {revenueBars.map((bar) => (
                        <div className="sim-bar-row" key={bar.label}>
                          <div className="sim-bar-label">
                            <span>{bar.label}</span>
                            <strong>{money(bar.value)}</strong>
                          </div>
                          <div className="sim-bar-track">
                            <div
                              className="sim-bar-fill"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (bar.value / maxRevenue) * 100,
                                  ),
                                )}%`,
                                background: bar.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="sim-comparison">
                      <div>
                        <span>Baseline monthly profit</span>
                        <strong>{money(baselineResult.profit)}</strong>
                      </div>
                      <div>
                        <span>Experiment monthly profit</span>
                        <strong
                          className={
                            result.profit >= baselineResult.profit
                              ? "sim-positive"
                              : "sim-negative"
                          }
                        >
                          {money(result.profit)}
                        </strong>
                      </div>
                      <div>
                        <span>Monthly profit difference</span>
                        <strong
                          className={
                            result.profit >= baselineResult.profit
                              ? "sim-positive"
                              : "sim-negative"
                          }
                        >
                          {result.profit - baselineResult.profit >= 0
                            ? "+"
                            : ""}
                          {money(result.profit - baselineResult.profit)}
                        </strong>
                      </div>
                    </div>

                    <div className="sim-break-even">
                      <div>
                        <span>Estimated break-even revenue</span>
                        <strong>{money(result.breakEvenRevenue)}</strong>
                      </div>
                      <div>
                        <span>Revenue above / below break-even</span>
                        <strong
                          className={
                            breakEvenGap >= 0
                              ? "sim-positive"
                              : "sim-negative"
                          }
                        >
                          {breakEvenGap >= 0 ? "+" : ""}
                          {money(breakEvenGap)}
                        </strong>
                      </div>
                    </div>

                    <div className="sim-cash-note">
                      <Boxes size={17} />
                      <span>
                        Additional inventory cash budget:{" "}
                        <strong>{money(inputs.inventoryBudget)}</strong>.
                        This is tracked separately from profit and should
                        be considered in cash-flow planning.
                      </span>
                    </div>
                  </section>

                  <section className="panel sim-sensitivity-panel">
                    <div className="sim-panel-heading">
                      <div className="sim-panel-icon">
                        <Activity size={19} />
                      </div>
                      <div>
                        <span className="section-kicker">DECISION SIGNALS</span>
                        <h2>What the model is indicating</h2>
                      </div>
                    </div>

                    <div className="sim-signal-list">
                      <div>
                        {result.profit >= baselineResult.profit ? (
                          <ArrowUpRight size={19} />
                        ) : (
                          <ArrowDownRight size={19} />
                        )}
                        <div>
                          <strong>Profit impact</strong>
                          <p>
                            The current assumptions{" "}
                            {result.profit >= baselineResult.profit
                              ? "increase"
                              : "decrease"}{" "}
                            modeled monthly profit by{" "}
                            {money(
                              Math.abs(
                                result.profit - baselineResult.profit,
                              ),
                            )}{" "}
                            compared with the baseline model.
                          </p>
                        </div>
                      </div>

                      <div>
                        <Activity size={19} />
                        <div>
                          <strong>Operating margin</strong>
                          <p>
                            The modeled profit margin is{" "}
                            {result.margin.toFixed(1)}%. Compare this with
                            your real historical margin before making
                            a decision.
                          </p>
                        </div>
                      </div>

                      <div>
                        <Wallet size={19} />
                        <div>
                          <strong>Cash requirements</strong>
                          <p>
                            Budget separately for inventory, new staff and
                            marketing. Positive modeled profit does not
                            automatically mean sufficient cash is available.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <section className="panel sim-experiment-panel">
                <div className="sim-panel-heading">
                  <div className="sim-panel-icon">
                    <Save size={19} />
                  </div>
                  <div>
                    <span className="section-kicker">EXPERIMENT HISTORY</span>
                    <h2>Save and compare experiments</h2>
                    <p>
                      Save scenarios in this page session so you can reload
                      their inputs and compare results.
                    </p>
                  </div>
                </div>

                <div className="sim-save-row">
                  <input
                    aria-label="Experiment name"
                    value={experimentName}
                    onChange={(event) =>
                      setExperimentName(event.target.value)
                    }
                    placeholder="Name this experiment"
                    maxLength={80}
                  />
                  <button
                    className="sim-run-button"
                    onClick={saveExperiment}
                  >
                    <Save size={16} />
                    Save experiment
                  </button>
                </div>

                {experiments.length === 0 ? (
                  <p className="sim-empty">
                    No experiments saved in this session yet. Configure
                    the controls and save a scenario to start comparing.
                  </p>
                ) : (
                  <div className="sim-experiment-list">
                    {experiments.map((experiment) => (
                      <button
                        key={experiment.id}
                        className="sim-experiment-row"
                        onClick={() => loadExperiment(experiment)}
                      >
                        <div>
                          <strong>{experiment.name}</strong>
                          <small>
                            Price {experiment.inputs.priceChange >= 0 ? "+" : ""}
                            {experiment.inputs.priceChange}% · Demand{" "}
                            {experiment.inputs.demandChange >= 0 ? "+" : ""}
                            {experiment.inputs.demandChange}%
                          </small>
                        </div>
                        <div>
                          <strong>{money(experiment.result.profit)}</strong>
                          <small>Modeled monthly profit · Load scenario</small>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel sim-ai-panel">
                <div className="sim-panel-heading">
                  <div className="sim-ai-icon">
                    <Bot size={22} />
                  </div>
                  <div>
                    <span className="section-kicker">GROQ AI REASONING</span>
                    <h2>Ask AI to evaluate your experiment</h2>
                    <p>
                      Get an interpretation of your modeled results, risks,
                      assumptions and recommended next experiments.
                    </p>
                  </div>
                </div>

                <div className="sim-ai-summary">
                  <div>
                    <span>Experiment revenue</span>
                    <strong>{money(result.revenue)}</strong>
                  </div>
                  <div>
                    <span>Experiment profit</span>
                    <strong>{money(result.profit)}</strong>
                  </div>
                  <div>
                    <span>Planning horizon</span>
                    <strong>{inputs.horizon} months</strong>
                  </div>
                </div>

                <button
                  className="sim-run-button"
                  onClick={() => void askGroq()}
                  disabled={aiLoading || loading}
                >
                  {aiLoading ? (
                    <LoaderCircle className="sim-spin" size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {aiLoading
                    ? "Analyzing experiment…"
                    : "Analyze with Groq AI"}
                </button>

                {aiReport && (
                  <div className="sim-ai-report">
                    <h3>
                      <BrainCircuit size={17} />
                      Simulation analyst report
                    </h3>
                    <div className="sim-ai-report-content">
                      {aiReport}
                    </div>
                  </div>
                )}
              </section>

              <section className="sim-disclaimer">
                <CircleAlert size={17} />
                <p>
                  <strong>Simulation, not certainty.</strong> This virtual
                  model uses simplified assumptions, including hypothetical
                  price elasticity and a 60/40 variable/fixed cost split.
                  Results are not validated forecasts. Experiment history
                  is held in page memory and is cleared when the page
                  session is reset or reloaded. No real business records
                  are changed by running a simulation.
                </p>
              </section>
            </>
          )}

          <footer className="page-footer">
            TwinIT <span>·</span> Simulate smarter. Decide better.
            <span className="footer-right">
              Virtual experiments · No live business changes
            </span>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        .sim-page {
          --sim-border: #e2e8f0;
          --sim-muted: #64748b;
          --sim-text: #0f172a;
        }

        .sim-overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.9rem;
          margin: 1.3rem 0 1.5rem;
        }

        .sim-overview-card {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          min-width: 0;
          padding: 1rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.8rem;
          background: white;
        }

        .sim-overview-card > span,
        .sim-overview-card > small {
          color: var(--sim-muted);
          font-size: 0.77rem;
        }

        .sim-overview-card > strong {
          font-size: 1.15rem;
          overflow-wrap: anywhere;
        }

        .sim-workspace {
          display: grid;
          grid-template-columns: minmax(300px, 0.88fr) minmax(0, 1.5fr);
          gap: 1.1rem;
          align-items: start;
        }

        .sim-control-panel,
        .sim-results-panel,
        .sim-sensitivity-panel,
        .sim-experiment-panel,
        .sim-ai-panel {
          padding: 1.2rem;
        }

        .sim-panel-heading {
          display: flex;
          align-items: flex-start;
          gap: 0.8rem;
          margin-bottom: 1.2rem;
        }

        .sim-panel-icon,
        .sim-ai-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 0.7rem;
          background: #eff6ff;
          color: #2563eb;
        }

        .sim-panel-heading h2 {
          margin: 0.3rem 0;
          font-size: 1.08rem;
          font-weight: 750;
        }

        .sim-panel-heading p {
          margin: 0.25rem 0 0;
          color: var(--sim-muted);
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .sim-controls-group {
          margin: 1.25rem 0;
          padding-top: 1rem;
          border-top: 1px solid #eef2f7;
        }

        .sim-group-title {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 1rem;
        }

        .sim-group-title h3 {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 700;
        }

        .sim-field {
          margin: 1.1rem 0 1.4rem;
        }

        .sim-field-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.8rem;
        }

        .sim-field-header label {
          font-size: 0.83rem;
          font-weight: 650;
        }

        .sim-field-header strong {
          font-size: 0.82rem;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .sim-field input[type="range"] {
          display: block;
          width: 100%;
          margin: 0.85rem 0 0.25rem;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .sim-range-labels {
          display: flex;
          justify-content: space-between;
          color: var(--sim-muted);
          font-size: 0.69rem;
        }

        .sim-field p,
        .sim-horizon-field p {
          margin: 0.55rem 0 0;
          color: var(--sim-muted);
          font-size: 0.75rem;
          line-height: 1.6;
        }

        .sim-horizon-field {
          padding-top: 1rem;
          border-top: 1px solid #eef2f7;
        }

        .sim-horizon-field label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.5rem;
          font-size: 0.82rem;
          font-weight: 650;
        }

        .sim-horizon-field select {
          width: 100%;
          padding: 0.7rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.55rem;
          background: white;
        }

        .sim-action-row {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 1.2rem;
        }

        .sim-run-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 0.55rem;
          background: #0f172a;
          color: white;
          font-size: 0.82rem;
          font-weight: 650;
          cursor: pointer;
        }

        .sim-run-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .sim-local-note {
          margin: 0.85rem 0 0;
          color: var(--sim-muted);
          font-size: 0.73rem;
          line-height: 1.6;
        }

        .sim-results-column {
          display: grid;
          gap: 1.1rem;
        }

        .sim-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .sim-metric {
          min-width: 0;
          padding: 0.9rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.7rem;
          background: #fff;
        }

        .sim-metric-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
          color: var(--sim-muted);
          font-size: 0.75rem;
        }

        .sim-metric > strong {
          display: block;
          margin-top: 0.8rem;
          font-size: clamp(1.05rem, 2vw, 1.4rem);
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .sim-metric > small {
          display: block;
          margin-top: 0.45rem;
          color: var(--sim-muted);
          font-size: 0.7rem;
          line-height: 1.5;
        }

        .sim-positive {
          color: #047857 !important;
        }

        .sim-negative {
          color: #b91c1c !important;
        }

        .sim-chart-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.7rem;
          margin-top: 1.4rem;
        }

        .sim-chart-title h3 {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .sim-chart-title span {
          color: var(--sim-muted);
          font-size: 0.72rem;
        }

        .sim-revenue-chart {
          display: grid;
          gap: 1rem;
          margin: 1rem 0;
        }

        .sim-bar-label {
          display: flex;
          justify-content: space-between;
          gap: 0.6rem;
          margin-bottom: 0.4rem;
          font-size: 0.77rem;
        }

        .sim-bar-label strong {
          font-variant-numeric: tabular-nums;
        }

        .sim-bar-track {
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: #f1f5f9;
        }

        .sim-bar-fill {
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
          transition: width 150ms ease;
        }

        .sim-comparison,
        .sim-break-even {
          display: grid;
          gap: 0.7rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #eef2f7;
        }

        .sim-comparison > div,
        .sim-break-even > div {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          font-size: 0.79rem;
        }

        .sim-comparison span,
        .sim-break-even span {
          color: var(--sim-muted);
        }

        .sim-comparison strong,
        .sim-break-even strong {
          text-align: right;
          overflow-wrap: anywhere;
        }

        .sim-cash-note {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          margin-top: 1rem;
          padding: 0.8rem;
          border-radius: 0.6rem;
          background: #f8fafc;
          color: #475569;
          font-size: 0.76rem;
          line-height: 1.6;
        }

        .sim-cash-note svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .sim-signal-list {
          display: grid;
          gap: 1rem;
        }

        .sim-signal-list > div {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
        }

        .sim-signal-list svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .sim-signal-list strong {
          font-size: 0.83rem;
        }

        .sim-signal-list p {
          margin: 0.3rem 0 0;
          color: var(--sim-muted);
          font-size: 0.78rem;
          line-height: 1.65;
        }

        .sim-experiment-panel,
        .sim-ai-panel {
          margin-top: 1.1rem;
        }

        .sim-save-row {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .sim-save-row input {
          flex: 1;
          min-width: 180px;
          padding: 0.75rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.55rem;
        }

        .sim-empty {
          margin: 1rem 0 0;
          color: var(--sim-muted);
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .sim-experiment-list {
          display: grid;
          gap: 0.65rem;
          margin-top: 1rem;
        }

        .sim-experiment-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          width: 100%;
          padding: 0.85rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.65rem;
          background: white;
          text-align: left;
          cursor: pointer;
        }

        .sim-experiment-row > div {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
        }

        .sim-experiment-row > div:last-child {
          text-align: right;
        }

        .sim-experiment-row strong {
          font-size: 0.83rem;
          overflow-wrap: anywhere;
        }

        .sim-experiment-row small {
          color: var(--sim-muted);
          font-size: 0.72rem;
          line-height: 1.5;
        }

        .sim-ai-icon {
          background: #f5f3ff;
          color: #7c3aed;
        }

        .sim-ai-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.7rem;
          margin: 1rem 0;
        }

        .sim-ai-summary > div {
          display: grid;
          gap: 0.4rem;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.6rem;
        }

        .sim-ai-summary span {
          color: var(--sim-muted);
          font-size: 0.73rem;
        }

        .sim-ai-summary strong {
          font-size: 0.9rem;
          overflow-wrap: anywhere;
        }

        .sim-ai-report {
          margin-top: 1rem;
          padding: 1rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.7rem;
          background: #fff;
        }

        .sim-ai-report h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 0.8rem;
          font-size: 0.92rem;
          font-weight: 700;
        }

        .sim-ai-report-content {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font-size: 0.86rem;
          line-height: 1.8;
        }

        .sim-alert {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          margin: 1rem 0;
          padding: 0.9rem 1rem;
          border: 1px solid #fecaca;
          border-radius: 0.65rem;
          background: #fef2f2;
          color: #991b1b;
          font-size: 0.82rem;
          line-height: 1.65;
        }

        .sim-alert svg {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }

        .sim-alert-warning {
          border-color: #fcd34d;
          background: #fffbeb;
          color: #92400e;
        }

        .sim-alert p {
          margin: 0.3rem 0 0;
        }

        .sim-disclaimer {
          display: flex;
          align-items: flex-start;
          gap: 0.7rem;
          margin-top: 1.2rem;
          padding: 0.9rem;
          border: 1px solid var(--sim-border);
          border-radius: 0.65rem;
          color: var(--sim-muted);
          font-size: 0.77rem;
          line-height: 1.7;
        }

        .sim-disclaimer svg {
          flex-shrink: 0;
          margin-top: 0.15rem;
        }

        .sim-disclaimer p {
          margin: 0;
        }

        .sim-loading {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 0.7rem;
        }

        .sim-loading p {
          color: var(--sim-muted);
        }

        .sim-spin {
          animation: sim-spin 1s linear infinite;
        }

        @keyframes sim-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .sim-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sim-workspace {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .sim-overview-grid,
          .sim-metrics-grid {
            grid-template-columns: 1fr;
          }

          .sim-control-panel,
          .sim-results-panel,
          .sim-sensitivity-panel,
          .sim-experiment-panel,
          .sim-ai-panel {
            padding: 0.9rem;
          }

          .sim-ai-summary {
            grid-template-columns: 1fr;
          }

          .sim-experiment-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .sim-experiment-row > div:last-child {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
