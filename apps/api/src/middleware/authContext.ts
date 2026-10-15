import { Request, Response, NextFunction } from "express";

export interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  allowedOfficeIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

export function authContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract or default company context
  const companyId = (req.headers["x-company-id"] as string) || process.env.DEFAULT_COMPANY_ID || "comp-bridgeone-01";
  const userId = (req.headers["x-user-id"] as string) || "usr-bridgeone-procurement-mgr";
  const userName = (req.headers["x-user-name"] as string) || "Mahfuz Rahman";
  const userRole = (req.headers["x-user-role"] as string) || "PURCHASE_MANAGER";

  req.userContext = {
    id: userId,
    name: userName,
    email: "m.rahman@bridgeone.com",
    role: userRole,
    companyId,
    companyName: process.env.DEFAULT_COMPANY_NAME || "BridgeOne Technologies Ltd.",
    allowedOfficeIds: ["off-01", "off-02", "off-03"],
  };

  next();
}
