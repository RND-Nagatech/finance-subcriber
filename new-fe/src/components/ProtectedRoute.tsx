import { Navigate } from "react-router-dom";
import { secureStorage } from "@/utils/secureStorage";

interface Props {
  children: JSX.Element;
}

export const ProtectedRoute = ({ children }: Props) => {
  const token = secureStorage.getItem("auth_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
