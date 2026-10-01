import { describe, expect, it } from "vitest";
import {
  getLoginLimits,
  LOGIN_GAGAL_PER_AKUN_BAWAAN,
  LOGIN_GAGAL_PER_IP_BAWAAN,
  LOGIN_MAKS_PER_IP_BAWAAN,
} from "@/lib/auth/login-limit";

describe("getLoginLimits", () => {
  it("tanpa pengaturan memakai bawaan (cukup dipakai tanpa disetel)", () => {
    expect(getLoginLimits({})).toEqual({ gagalPerIp: 30, gagalPerAkun: 5, maksPerIp: 600 });
    expect(LOGIN_GAGAL_PER_IP_BAWAAN).toBe(30);
    expect(LOGIN_GAGAL_PER_AKUN_BAWAAN).toBe(5);
    expect(LOGIN_MAKS_PER_IP_BAWAAN).toBe(600);
  });

  it("nilai kosong atau spasi saja jatuh ke bawaan", () => {
    expect(getLoginLimits({ LOGIN_FAIL_LIMIT_PER_IP: "", LOGIN_MAX_PER_IP: "   " })).toEqual(getLoginLimits({}));
  });

  it("angka bulat positif dipakai apa adanya, masing-masing terpisah", () => {
    expect(getLoginLimits({ LOGIN_FAIL_LIMIT_PER_IP: "10", LOGIN_FAIL_LIMIT_PER_ACCOUNT: " 3 ", LOGIN_MAX_PER_IP: "2000" })).toEqual({
      gagalPerIp: 10,
      gagalPerAkun: 3,
      maksPerIp: 2000,
    });
    expect(getLoginLimits({ LOGIN_MAX_PER_IP: "50" })).toEqual({ gagalPerIp: 30, gagalPerAkun: 5, maksPerIp: 50 });
  });

  it("nilai salah ketik jatuh ke bawaan, bukan membuka login tanpa batas", () => {
    for (const v of ["abc", "0", "-5", "1.5", "Infinity", "NaN", "1e3x"]) {
      expect(getLoginLimits({ LOGIN_FAIL_LIMIT_PER_IP: v, LOGIN_FAIL_LIMIT_PER_ACCOUNT: v, LOGIN_MAX_PER_IP: v })).toEqual(
        getLoginLimits({}),
      );
    }
  });
});
