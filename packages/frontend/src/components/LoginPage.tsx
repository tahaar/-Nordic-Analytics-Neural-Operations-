import React from "react";
import { Button, Container, Paper, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { redirectToLogin } from "../auth/authService";

export function LoginPage() {
  return (
    <Container maxWidth="xs" sx={{ pt: 10 }}>
      <Paper sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
        <Stack spacing={2} alignItems="center">
          <LockOutlinedIcon sx={{ fontSize: 48, color: "primary.main" }} />
          <Typography variant="h5">Nordic Match Center</Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in with your Azure account to continue.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={redirectToLogin}
          >
            Login with Entra ID
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
