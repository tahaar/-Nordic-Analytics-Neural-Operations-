import React from "react";
import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { logout } from "../auth/authService";

export function LogoutButton() {
  return (
    <Button
      variant="outlined"
      color="inherit"
      size="small"
      startIcon={<LogoutIcon />}
      onClick={logout}
    >
      Logout
    </Button>
  );
}
