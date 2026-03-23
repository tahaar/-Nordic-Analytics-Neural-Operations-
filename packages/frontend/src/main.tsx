import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { App } from "./App";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2b4a5d" },
    secondary: { main: "#5f7c8f" },
    background: { default: "#eef2f5", paper: "#f8fafb" },
  },
  typography: {
    fontFamily:
      "'SF Pro Display', 'SF Pro Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  },
  shape: {
    borderRadius: 14,
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
