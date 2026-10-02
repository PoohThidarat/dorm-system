import { tenantRepository } from "../repositories/tenant.repository";
import { userRepository } from "../repositories/user.repository";
import { contractRepository } from "../repositories/contract.repository";
import { contractService } from "./contract.service";
import { hashPassword } from "../utils/password";
import { ApiError } from "../utils/apiResponse";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { CreateTenantInput, UpdateTenantInput } from "../validators/tenant.validator";

// หน้าที่ของไฟล์: Business logic ของ Tenant Management (spec ข้อ 6)
// การเพิ่มผู้เช่าใหม่ = สร้าง User (role TENANT) + Tenant profile พร้อมกันเสมอ

export const tenantService = {
  async list(query: ListQuery, filters: { status?: "ACTIVE" | "INACTIVE" | "MOVED_OUT" }) {
    const { items, total } = await tenantRepository.findMany(query, filters);
    return paginatedResult(items, total, query);
  },

  async getById(id: number) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบผู้เช่านี้");
    return tenant;
  },

  async create(input: CreateTenantInput) {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "อีเมลนี้ถูกใช้งานแล้ว");

    const existingNationalId = await tenantRepository.findByNationalId(input.nationalId);
    if (existingNationalId) {
      throw new ApiError(409, "NATIONAL_ID_ALREADY_EXISTS", "เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว");
    }

    const tenantRole = await userRepository.findRoleByName("TENANT");
    if (!tenantRole) throw new ApiError(500, "ROLE_NOT_SEEDED", "ไม่พบ Role TENANT ในระบบ กรุณา seed ข้อมูลก่อน");

    const passwordHash = await hashPassword(input.password);

    return tenantRepository.createWithUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      roleId: tenantRole.id,
      nationalId: input.nationalId,
      address: input.address,
    });
  },

  async update(id: number, input: UpdateTenantInput) {
    await this.getById(id);
    return tenantRepository.update(id, input);
  },

  // ย้ายห้อง: หา contract Active ปัจจุบันของผู้เช่า แล้วสั่งย้ายผ่าน contractService (spec ข้อ 6)
  async moveRoom(tenantId: number, newRoomId: number) {
    const activeContract = await contractRepository.findActiveByTenantId(tenantId);
    if (!activeContract) {
      throw new ApiError(400, "NO_ACTIVE_CONTRACT", "ผู้เช่ารายนี้ไม่มีสัญญา Active ให้ย้ายห้อง");
    }
    return contractService.moveRoom(activeContract.id, newRoomId);
  },

  // ยกเลิกการเช่า: ยกเลิก contract Active ปัจจุบันของผู้เช่า (spec ข้อ 6)
  async cancelRental(tenantId: number) {
    const activeContract = await contractRepository.findActiveByTenantId(tenantId);
    if (!activeContract) {
      throw new ApiError(400, "NO_ACTIVE_CONTRACT", "ผู้เช่ารายนี้ไม่มีสัญญา Active ให้ยกเลิก");
    }
    return contractService.terminate(activeContract.id);
  },

  async remove(id: number) {
    const tenant = await this.getById(id);
    const activeContract = await contractRepository.findActiveByTenantId(id);
    if (activeContract) {
      throw new ApiError(409, "TENANT_HAS_ACTIVE_CONTRACT", "ไม่สามารถลบผู้เช่าที่มีสัญญา Active อยู่ได้");
    }
    await tenantRepository.softDelete(tenant.id);
  },
};
