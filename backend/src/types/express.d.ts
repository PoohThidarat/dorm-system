import { JwtPayload } from "../utils/jwt";

// หน้าที่ของไฟล์: ขยาย Express Request type ให้มี req.user หลังผ่าน auth middleware
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
