import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { BudgetsPage, HomePage, MorePage, StatsPage, TransactionsPage } from "./features/pages";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="plus" element={<MorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
