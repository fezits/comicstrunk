"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextType } from "./auth-context";

/**
 * Hook to access the auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
        "Wrap your component tree with <AuthProvider>."
    );
  }

  return context;
}
