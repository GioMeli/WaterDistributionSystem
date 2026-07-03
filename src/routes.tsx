// Route definitions are managed in App.tsx via React Router.
// This file is retained for type export compatibility only.
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [];
