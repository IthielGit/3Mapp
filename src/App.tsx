import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { RequireOnboarding } from "./components/RequireOnboarding";
import { BudgetsPage } from "./features/budgets/BudgetsPage";
import { BudgetDetailPage } from "./features/budgets/BudgetDetailPage";
import { BudgetFormPage } from "./features/budgets/BudgetFormPage";
import { RecurringPage, RecurringDetailPage } from "./features/recurring/RecurringPage";
import { RecurringFormPage } from "./features/recurring/RecurringFormPage";
import { GoalsPage } from "./features/goals-debts/GoalsPage";
import { DebtsPage } from "./features/goals-debts/DebtsPage";
import { ReconcilePage } from "./features/money/ReconcilePage";
import { RatesPage } from "./features/money/RatesPage";
import { HomePage } from "./features/home/HomePage";
import { StatsPage } from "./features/stats/StatsPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { MorePage } from "./features/more/MorePage";
import { TransactionsPage } from "./features/transactions/TransactionsPage";
import { WalletsPage } from "./features/wallets/WalletsPage";
import { WalletFormPage } from "./features/wallets/WalletFormPage";
import { WalletDetailPage } from "./features/wallets/WalletDetailPage";
import { ImportExportPage } from "./features/import-export/ImportExportPage";
import { CategoriesPage } from "./features/categories/CategoriesPage";
import { CategoryFormPage } from "./features/categories/CategoryFormPage";

export default function App() {
  return (
    <Routes>
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route
        element={
          <RequireOnboarding>
            <AppLayout />
          </RequireOnboarding>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/new" element={<TransactionsPage />} />
        <Route path="transactions/:id/edit" element={<TransactionsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="budgets/new" element={<BudgetFormPage />} />
        <Route path="budgets/:id" element={<BudgetDetailPage />} />
        <Route path="budgets/:id/edit" element={<BudgetFormPage />} />
        <Route path="plus" element={<MorePage />} />
        <Route path="plus/wallets" element={<WalletsPage />} />
        <Route path="plus/wallets/new" element={<WalletFormPage />} />
        <Route path="plus/wallets/:id" element={<WalletDetailPage />} />
        <Route path="plus/wallets/:id/edit" element={<WalletFormPage />} />
        <Route path="plus/import" element={<ImportExportPage />} />
        <Route path="plus/recurring" element={<RecurringPage />} />
        <Route path="plus/recurring/new" element={<RecurringFormPage />} />
        <Route path="plus/recurring/:id" element={<RecurringDetailPage />} />
        <Route path="plus/goals" element={<GoalsPage />} />
        <Route path="plus/goals/:id" element={<GoalsPage />} />
        <Route path="plus/debts" element={<DebtsPage />} />
        <Route path="plus/debts/:id" element={<DebtsPage />} />
        <Route path="plus/rates" element={<RatesPage />} />
        <Route path="plus/wallets/:id/reconcile" element={<ReconcilePage />} />
        <Route path="plus/categories" element={<CategoriesPage />} />
        <Route path="plus/categories/new" element={<CategoryFormPage />} />
        <Route path="plus/categories/:id/edit" element={<CategoryFormPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
