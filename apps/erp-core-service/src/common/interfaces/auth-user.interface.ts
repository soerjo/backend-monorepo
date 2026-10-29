export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  orgs?: string[];
}
