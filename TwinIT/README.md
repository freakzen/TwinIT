# TwinIT — Business Digital Twin

TwinIT is a Next.js + Supabase prototype for helping small businesses explore their numbers and compare possible decisions.

## Included in this iteration

- Existing Supabase email/password authentication, auth callback, onboarding and avatar upload preserved.
- Responsive workspace navigation and business overview dashboard.
- Revenue, expenses, estimated profit, margin and customer metrics from the signed-in user's Supabase business record.
- Recharts revenue/expense visual with clearly labelled illustrative historical values.
- Interactive what-if simulation for revenue/pricing impact, marketing spend and operating expenses.
- Transparent flat-baseline projections for 3, 6 or 12 months.
- Rule-based decision suggestions based on the entered business profile.
- CSV export for scenario and business summary reports.
- Responsive layout for desktop and mobile.

## Setup

1. Use Node.js compatible with your Next.js version.
2. Copy `.env.local.example` to `.env.local` (or create `.env.local`) and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Ensure the existing Supabase schema, profiles/businesses RLS policies, and `avatars` bucket/policies are configured as described in your project's setup.
4. Install dependencies and run:
   ```bash
   npm ci
   npm run dev
   ```
5. Open http://localhost:3000.

## Important model limitations

This iteration does not claim to use trained AI or real historical transaction data. The dashboard's six-month visual is an illustrative trend derived from the current profile. Forecasts use a flat baseline. Recommendations are rule-based. Simulation values are simple what-if calculations, not causal estimates or guaranteed outcomes.

## Next milestones

1. Add business transaction history and CSV import.
2. Persist scenario configurations and simulation results in Supabase.
3. Add validated time-series forecasting after enough real data exists.
4. Add an AI explanation layer with bounded inputs, citations to business metrics, and safe fallbacks.
5. Add role-based access, audit logging, report exports and production monitoring.

## Groq-powered Business AI Analyst

1. Add these values to your local `.env.local` file (keep this file private):

   ```env
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   ```

   `GROQ_API_KEY` is server-only; never use a `NEXT_PUBLIC_` prefix for it. The model can be changed to another active Groq model available to your account.

2. In Supabase SQL Editor, run `database/migrations/ai_business_data.sql` after the existing TwinIT schema. It creates private, user-scoped tables for monthly history, transactions, products/inventory, and expense records.
3. Restart the Next.js dev server after changing `.env.local`:

   ```powershell
   npm run dev
   ```

4. Open `/chat` or choose **AI analyst** in the sidebar.

The server verifies the current Supabase user, fetches only their business data, calculates basic profit/margin in application code, and passes that context to Groq. The model is instructed not to invent missing data. Predictions remain limited until you enter/import dated historical data. This starter currently reads these data tables; data-entry and CSV import screens should be added next.

### Data to collect for stronger business analysis

- Monthly actual revenue, operating expenses, customer/order counts and marketing spend.
- Dated transactions with category and amount; sales/refunds should be categorized consistently.
- Product-level price, unit cost, stock quantity and reorder level.
- Dated expenses with categories and recurring-cost flags.
- Later, optionally add anonymized customer cohorts, promotions, returns, supplier lead times and seasonal events. Avoid uploading unnecessary personally identifiable customer data.
