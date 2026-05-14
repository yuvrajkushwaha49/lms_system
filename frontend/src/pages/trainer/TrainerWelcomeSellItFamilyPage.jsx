import { Navigate } from "react-router-dom";

/** Legacy URL: welcome video now lives under Trainer Start Here. */
export default function TrainerWelcomeSellItFamilyPage() {
  return <Navigate to="/dashboard/trainer-start-here" replace />;
}
