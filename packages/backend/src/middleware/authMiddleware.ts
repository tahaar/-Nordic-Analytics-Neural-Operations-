import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { AUTH_CONFIG } from "../config/auth";

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${AUTH_CONFIG.tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 min
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err ?? new Error("No signing key found"));
      return;
    }
    callback(null, key.getPublicKey());
  });
}

export type AuthenticatedUser = {
  sub: string;
  name?: string;
  email?: string;
  roles: string[];
};

// Augment Express Request so downstream handlers can access req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.substring("Bearer ".length);

  jwt.verify(
    token,
    getSigningKey,
    {
      audience: AUTH_CONFIG.audience,
      issuer: AUTH_CONFIG.issuer,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err ?? !decoded) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      const payload = decoded as JwtPayload;
      const rawRoles = payload["roles"] ?? payload["role"] ?? [];
      const roles: string[] = Array.isArray(rawRoles) ? rawRoles : [String(rawRoles)];

      if (!hasRequiredRole(roles, "AppUser")) {
        res.status(403).json({ error: "Missing required role: AppUser" });
        return;
      }

      req.user = {
        sub: payload.sub ?? "",
        name: payload["name"] as string | undefined,
        email: (payload["preferred_username"] ?? payload["email"]) as string | undefined,
        roles,
      };

      next();
    },
  );
}

export function hasRequiredRole(userRoles: string[], requiredRole: string): boolean {
  return userRoles.some((role) => role === requiredRole);
}

export function requireRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!hasRequiredRole(req.user.roles, requiredRole)) {
      res.status(403).json({ error: `Missing required role: ${requiredRole}` });
      return;
    }

    next();
  };
}
