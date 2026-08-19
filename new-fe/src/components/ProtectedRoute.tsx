import { Navigate } from "react-router-dom";
import { secureStorage } from "@/utils/secureStorage";
import { getLoginFallbackUrl } from "@/utils/programInternalRedirect";

interface Props {
  children: JSX.Element;
}

export const ProtectedRoute = ({ children }: Props) => {
  const token = secureStorage.getItem("auth_token");

  if (!token) {
    const fallbackUrl = getLoginFallbackUrl();
    if (fallbackUrl.startsWith("http")) {
      window.location.replace(fallbackUrl);
      return null;
    }
    return <Navigate to={fallbackUrl} replace />;
  }

  return children;
};
