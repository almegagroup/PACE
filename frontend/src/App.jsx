import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import SplashScreen from "./components/SplashScreen";
import LoginPage from "./pages/public/LoginPage";
import SignupRequestPage from "./pages/public/SignupRequestPage";
import FirstLoginPage from "./pages/public/FirstLoginPage";
import ForgotPasswordPage from "./pages/public/ForgotPasswordPage";
import ForgotPasscodePage from "./pages/public/ForgotPasscodePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Zone */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/auth/signup-request" element={<SignupRequestPage />} />
        <Route path="/auth/first-login" element={<FirstLoginPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/forgot-passcode" element={<ForgotPasscodePage />} />

        {/* Safety */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
