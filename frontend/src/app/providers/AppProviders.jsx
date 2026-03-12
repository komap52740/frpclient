import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./AuthProvider";
import { QueryProvider } from "./QueryProvider";

export function AppProviders({ children }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryProvider>
  );
}
