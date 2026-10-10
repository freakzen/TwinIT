
export type BusinessProfile = {
  id: string;
  name: string;
  businessType: string;
  currency: "INR";
  monthlyRevenue: number;
  monthlyExpenses: number;
  customersPerDay: number;
  averageOrderValue: number;
  employees: number;
  marketingSpend: number;
  createdAt: string;
};

export const defaultBusiness: BusinessProfile = {
  id: "demo-business",
  name: "Acme Retail",
  businessType: "Retail",
  currency: "INR",
  monthlyRevenue: 510000,
  monthlyExpenses: 368000,
  customersPerDay: 42,
  averageOrderValue: 450,
  employees: 5,
  marketingSpend: 15000,
  createdAt: new Date().toISOString(),
};

export function calculateBusinessMetrics(business: BusinessProfile) {
  const profit = business.monthlyRevenue - business.monthlyExpenses;
  const margin =
    business.monthlyRevenue > 0
      ? (profit / business.monthlyRevenue) * 100
      : 0;

  return {
    revenue: business.monthlyRevenue,
    expenses: business.monthlyExpenses,
    profit,
    margin,
    estimatedDailyRevenue: business.monthlyRevenue / 30,
    estimatedMonthlyCustomers: business.customersPerDay * 30,
  };
}
