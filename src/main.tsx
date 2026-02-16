import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

registerSW({
  immediate: false,
  onNeedRefresh() {
    // Keep current session stable. New version applies on manual reload.
  },
});

function MissingClerkKey(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Missing Clerk publishable key</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your <code>.env</code> file and restart the app.
        </p>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      <MissingClerkKey />
    )}
  </React.StrictMode>,
);
