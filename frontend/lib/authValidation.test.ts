import { describe, expect, it } from "vitest";
import {
  validateAuthForm,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./authValidation";

describe("validateEmail", () => {
  it("rejects empty email", () => {
    expect(validateEmail("")).toBe("Email is required.");
    expect(validateEmail("   ")).toBe("Email is required.");
  });

  it("rejects invalid format", () => {
    expect(validateEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateEmail("a@b")).toBe("Enter a valid email address.");
  });

  it("accepts valid email", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("  user@example.com  ")).toBeNull();
  });
});

describe("validateUsername", () => {
  it("rejects empty and invalid usernames", () => {
    expect(validateUsername("")).toBe("Username is required.");
    expect(validateUsername("ab")).toBe(
      "Username must be at least 3 characters."
    );
    expect(validateUsername("bad-name")).toBe(
      "Username may only contain letters, numbers, and underscores."
    );
  });

  it("accepts valid username", () => {
    expect(validateUsername("luis_ced")).toBeNull();
  });
});

describe("validateDisplayName", () => {
  it("rejects empty display name", () => {
    expect(validateDisplayName("   ")).toBe("Display name is required.");
  });

  it("accepts trimmed display name", () => {
    expect(validateDisplayName("  Luis  ")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("rejects empty password", () => {
    expect(validatePassword("", "register")).toBe("Password is required.");
  });

  it("enforces register minimum", () => {
    expect(validatePassword("short", "register")).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("allows short password on login", () => {
    expect(validatePassword("x", "login")).toBeNull();
  });

  it("rejects passwords over max length", () => {
    expect(validatePassword("a".repeat(129), "login")).toBe(
      "Password must be at most 128 characters."
    );
  });
});

describe("validateAuthForm", () => {
  it("returns all register field errors", () => {
    expect(
      validateAuthForm(
        { email: "", password: "", username: "", displayName: "" },
        "register"
      )
    ).toEqual({
      email: "Email is required.",
      username: "Username is required.",
      displayName: "Display name is required.",
      password: "Password is required.",
    });
  });

  it("returns empty object when valid", () => {
    expect(
      validateAuthForm(
        {
          email: "user@example.com",
          username: "user_name",
          displayName: "User Name",
          password: "hunter2hunter2",
        },
        "register"
      )
    ).toEqual({});
  });
});
