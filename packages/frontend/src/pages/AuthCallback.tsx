import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { handleAuthCallback } from "../auth/authService";

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const ok = handleAuthCallback();
    if (ok) {
      navigate("/", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 10, gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">Signing you in…</Typography>
    </Box>
  );
}
