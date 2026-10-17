export interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
  orgs?: string[];
}
