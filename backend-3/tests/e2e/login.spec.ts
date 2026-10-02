import { test, expect } from "@playwright/test";

// หน้าที่ของไฟล์: E2E test สำหรับ Login flow (spec ข้อ 31)
// ต้อง seed ข้อมูล admin@example.com / Password123! ไว้ก่อนรัน และรัน frontend dev server ที่ localhost:3000

test.describe("Login", () => {
  test("login สำเร็จด้วยข้อมูลถูกต้อง", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@example.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("login ล้มเหลวเมื่อรหัสผ่านผิด", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "admin@example.com");
    await page.fill('input[type="password"]', "WrongPassword");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/)).toBeVisible();
  });

  test("username ไม่มีในระบบ", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.fill('input[type="email"]', "nouser@example.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/)).toBeVisible();
  });
});
