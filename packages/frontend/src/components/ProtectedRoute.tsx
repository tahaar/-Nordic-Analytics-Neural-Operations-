import React from "react";
import { Navigate } from "react-router-dom";
import { getAccessToken } from "../auth/authService";

type Props = { children: React.ReactElement };

export function ProtectedRoute({ children }: Props) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
