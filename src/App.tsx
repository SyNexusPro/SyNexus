import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomeFeed } from "./pages/HomeFeed";
import { Pulse } from "./pages/Pulse";
import { TokenDetail } from "./pages/TokenDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomeFeed />} />
          <Route path="pulse" element={<Pulse />} />
          <Route path="token/:tokenId" element={<TokenDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
