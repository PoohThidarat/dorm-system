import { hashPassword, verifyPassword } from "../../src/utils/password";

describe("password utils", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toBe("Password123!");
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Password123!");
    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  });
});
