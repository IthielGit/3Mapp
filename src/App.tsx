import { lazy, Suspense, type ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Announcer } from "./components/Announcer";
import { RequireOnboarding } from "./components/RequireOnboarding";
import { NotFoundPage } from "./components/NotFoundPage";
import { VisualisationLayout } from "./features/visualisation/VisualisationLayout";
import { Skeleton } from "./components/PwaComponents";
import { RequireSuperAdmin } from "./features/admin/RequireSuperAdmin";

/**
 * Chaque page est chargée à la demande : le bundle initial reste léger et les bibliothèques
 * lourdes (ExcelJS, Recharts, Papa Parse) ne sont téléchargées que sur les pages qui les utilisent.
 */
function page(load: () => Promise<{ default: ComponentType }>): ComponentType {
  return lazy(load);
}

const CalendarPage = page(() =>
  import("./features/calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const HomePage = page(() =>
  import("./features/home/HomePage").then((m) => ({ default: m.HomePage })),
);
const OnboardingPage = page(() =>
  import("./features/onboarding/OnboardingPage").then((m) => ({ default: m.OnboardingPage })),
);
const BackupPage = page(() =>
  import("./features/backup/BackupPage").then((m) => ({ default: m.BackupPage })),
);
const RestoreScreen = page(() =>
  import("./features/backup/RestoreScreen").then((m) => ({ default: m.RestoreScreen })),
);
const TransactionsPage = page(() =>
  import("./features/transactions/TransactionsPage").then((m) => ({
    default: m.TransactionsPage,
  })),
);
const StatsPage = page(() =>
  import("./features/stats/StatsPage").then((m) => ({ default: m.StatsPage })),
);
const BudgetsPage = page(() =>
  import("./features/budgets/BudgetsPage").then((m) => ({ default: m.BudgetsPage })),
);
const BudgetDetailPage = page(() =>
  import("./features/budgets/BudgetDetailPage").then((m) => ({ default: m.BudgetDetailPage })),
);
const BudgetFormPage = page(() =>
  import("./features/budgets/BudgetFormPage").then((m) => ({ default: m.BudgetFormPage })),
);
const MorePage = page(() =>
  import("./features/more/MorePage").then((m) => ({ default: m.MorePage })),
);
const WalletsPage = page(() =>
  import("./features/wallets/WalletsPage").then((m) => ({ default: m.WalletsPage })),
);
const WalletFormPage = page(() =>
  import("./features/wallets/WalletFormPage").then((m) => ({ default: m.WalletFormPage })),
);
const WalletDetailPage = page(() =>
  import("./features/wallets/WalletDetailPage").then((m) => ({ default: m.WalletDetailPage })),
);
const ImportExportPage = page(() =>
  import("./features/import-export/ImportExportPage").then((m) => ({
    default: m.ImportExportPage,
  })),
);
const RecurringPage = page(() =>
  import("./features/recurring/RecurringPage").then((m) => ({ default: m.RecurringPage })),
);
const RecurringDetailPage = page(() =>
  import("./features/recurring/RecurringPage").then((m) => ({
    default: m.RecurringDetailPage,
  })),
);
const RecurringFormPage = page(() =>
  import("./features/recurring/RecurringFormPage").then((m) => ({
    default: m.RecurringFormPage,
  })),
);
const GoalsPage = page(() =>
  import("./features/goals-debts/GoalsPage").then((m) => ({ default: m.GoalsPage })),
);
const DebtsPage = page(() =>
  import("./features/goals-debts/DebtsPage").then((m) => ({ default: m.DebtsPage })),
);
const ReconcilePage = page(() =>
  import("./features/money/ReconcilePage").then((m) => ({ default: m.ReconcilePage })),
);
const RatesPage = page(() =>
  import("./features/money/RatesPage").then((m) => ({ default: m.RatesPage })),
);
const SecurityPage = page(() =>
  import("./features/security/SecurityPage").then((m) => ({ default: m.SecurityPage })),
);
const CategoriesPage = page(() =>
  import("./features/categories/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
);
const CategoryDetailPage = page(() =>
  import("./features/categories/CategoryDetailPage").then((m) => ({ default: m.CategoryDetailPage })),
);
const AdminPage = page(() =>
  import("./features/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const AccountDetailPage = page(() =>
  import("./features/admin/AccountDetailPage").then((m) => ({ default: m.AccountDetailPage })),
);
const AuditPage = page(() =>
  import("./features/admin/AuditPage").then((m) => ({ default: m.AuditPage })),
);
const AccountPage = page(() =>
  import("./features/account/AccountPage").then((m) => ({ default: m.AccountPage })),
);
const CategoryFormPage = page(() =>
  import("./features/categories/CategoryFormPage").then((m) => ({
    default: m.CategoryFormPage,
  })),
);

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="p-4" aria-busy="true">
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <Announcer />
      <Routes>
        <Route path="onboarding" element={<OnboardingPage />} />
        {/* Restauration sur un navigateur vierge : accessible avant l'onboarding (SPEC §5.14). */}
        <Route path="restore" element={<RestoreScreen />} />
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
          <Route path="transactions/:id" element={<TransactionsPage />} />
          <Route path="transactions/:id/edit" element={<TransactionsPage />} />
          {/* Calendrier et Analyses vivent dans l’onglet Visualisation ; les anciennes adresses y renvoient. */}
          <Route path="visualisation" element={<VisualisationLayout />}>
            <Route index element={<Navigate to="stats" replace />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>
          <Route path="calendar" element={<Navigate to="/visualisation/calendar" replace />} />
          <Route path="stats" element={<Navigate to="/visualisation/stats" replace />} />
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
          <Route path="plus/backup" element={<BackupPage />} />
          <Route path="plus/recurring" element={<RecurringPage />} />
          <Route path="plus/recurring/new" element={<RecurringFormPage />} />
          <Route path="plus/recurring/:id/edit" element={<RecurringFormPage />} />
          <Route path="plus/recurring/:id" element={<RecurringDetailPage />} />
          <Route path="plus/goals" element={<GoalsPage />} />
          <Route path="plus/goals/:id" element={<GoalsPage />} />
          <Route path="plus/debts" element={<DebtsPage />} />
          <Route path="plus/debts/:id" element={<DebtsPage />} />
          <Route path="plus/rates" element={<RatesPage />} />
          <Route path="plus/security" element={<SecurityPage />} />
          <Route path="plus/account" element={<AccountPage />} />
          <Route path="plus/admin" element={<RequireSuperAdmin><AdminPage /></RequireSuperAdmin>} />
          <Route path="plus/admin/audit" element={<RequireSuperAdmin><AuditPage /></RequireSuperAdmin>} />
          <Route path="plus/admin/accounts/:id" element={<RequireSuperAdmin><AccountDetailPage /></RequireSuperAdmin>} />
          <Route path="plus/wallets/:id/reconcile" element={<ReconcilePage />} />
          <Route path="plus/categories" element={<CategoriesPage />} />
          <Route path="plus/categories/:id" element={<CategoryDetailPage />} />
          <Route path="plus/categories/new" element={<CategoryFormPage />} />
          <Route path="plus/categories/:id/edit" element={<CategoryFormPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
