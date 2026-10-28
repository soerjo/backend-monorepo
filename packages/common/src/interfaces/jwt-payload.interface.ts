export interface JwtPayload {
  sub: string;
  email: string;
  sid?: string;
  roles?: string[];
  orgs?: string[];
  perms?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
