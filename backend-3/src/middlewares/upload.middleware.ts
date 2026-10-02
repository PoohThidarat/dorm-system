import fs from "fs";
import path from "path";
import multer from "multer";
import { ApiError } from "../utils/apiResponse";

// หน้าที่ของไฟล์: ตั้งค่า Multer สำหรับอัปโหลดไฟล์ พร้อมจำกัดประเภทและขนาดไฟล์ (spec ข้อ 24)
// ใช้ร่วมกันได้ทั้ง Contract PDF, Payment Slip, Maintenance Images

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subfolder: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_ROOT, subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });
}

const ALLOWED_PDF = [".pdf"];
const ALLOWED_IMAGE = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function fileFilterFor(
  allowedExtensions: string[],
): NonNullable<multer.Options["fileFilter"]> {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new ApiError(400, "INVALID_FILE_TYPE", `รองรับเฉพาะไฟล์ ${allowedExtensions.join(", ")}`));
    }
    cb(null, true);
  };
}

export const uploadContractPdf = multer({
  storage: makeStorage("contracts"),
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: fileFilterFor(ALLOWED_PDF),
});

export const uploadPaymentSlip = multer({
  storage: makeStorage("payment-slips"),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: fileFilterFor(ALLOWED_IMAGE),
});

export const uploadMaintenanceImage = multer({
  storage: makeStorage("maintenance"),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: fileFilterFor(ALLOWED_IMAGE),
});
