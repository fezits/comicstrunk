"use client";

import { createContext } from "react";
import type { AuthUser, SignupInput } from "@comicstrunk/contracts";

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: Omit<SignupInput, "acceptedTerms"> & { acceptedTerms: true }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
