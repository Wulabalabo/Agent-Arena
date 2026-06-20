import { StrictMode } from "react";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { dAppKit } from "./features/sui/dapp-kit";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <App />
    </DAppKitProvider>
  </StrictMode>
);
