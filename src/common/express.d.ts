import "express";

declare global {
  namespace Express {
    interface Request {
      user?: import("./types.js").AuthUser & {
        shopAccess?: import("./types.js").ShopAccess;
      };
    }
  }
}

export {};
