import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AdminApp from "./AdminApp.jsx";

// routing แบบง่ายๆ ไม่ต้องพึ่ง react-router เพราะมีแค่ 2 หน้า
// เข้า /admin -> หน้าแอดมิน, เส้นทางอื่นๆ ทั้งหมด -> แอปพนักงาน (LIFF)
const isAdminRoute = window.location.pathname.startsWith("/admin");

createRoot(document.getElementById("root")).render(
  <StrictMode>{isAdminRoute ? <AdminApp /> : <App />}</StrictMode>,
);
