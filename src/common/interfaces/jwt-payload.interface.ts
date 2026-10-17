export interface JwtPayload {
  sub: string;
  email: string;
  name?: string | null;
  roles: string[];
  orgs: string[];
  iss?: string;
  azp?: string;
  iat?: number;
  exp?: number;
}
