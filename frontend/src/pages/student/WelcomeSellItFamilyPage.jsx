import { Navigate } from "react-router-dom";

/** Legacy URL: welcome video now lives under Start Here. */
export default function WelcomeSellItFamilyPage() {
  return <Navigate to="/dashboard/student-start-here" replace />;
}
