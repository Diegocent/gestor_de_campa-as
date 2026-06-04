import jwt from "jsonwebtoken";
import type { AccessTokenClaims, TokenPair, TokenService } from "@gestor/core";

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export class JwtTokenService implements TokenService {
  constructor(private readonly config: JwtConfig) {}

  issuePair(claims: AccessTokenClaims): TokenPair {
    const payload = {
      organizationId: claims.organizationId,
      role: claims.role,
    };
    const accessToken = jwt.sign(payload, this.config.accessSecret, {
      subject: claims.sub,
      expiresIn: this.config.accessTtl as jwt.SignOptions["expiresIn"],
    });
    const refreshToken = jwt.sign(payload, this.config.refreshSecret, {
      subject: claims.sub,
      expiresIn: this.config.refreshTtl as jwt.SignOptions["expiresIn"],
    });
    return { accessToken, refreshToken };
  }

  verifyAccess(token: string): AccessTokenClaims {
    return this.decode(jwt.verify(token, this.config.accessSecret));
  }

  verifyRefresh(token: string): AccessTokenClaims {
    return this.decode(jwt.verify(token, this.config.refreshSecret));
  }

  private decode(decoded: string | jwt.JwtPayload): AccessTokenClaims {
    if (typeof decoded === "string" || !decoded.sub) {
      throw new Error("Token inválido");
    }
    return {
      sub: decoded.sub,
      organizationId: decoded.organizationId as string,
      role: decoded.role as AccessTokenClaims["role"],
    };
  }
}
