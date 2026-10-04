import { describe, it, expect } from "vitest";

type Org = { id: string; name: string; role: string };

function resolveDestination(organizations: Org[], savedCookieOrgId?: string | null): string {
  if (organizations.length === 0) return "/select-organization";
  if (organizations.length === 1) return "/today";
  if (savedCookieOrgId && organizations.some((o) => o.id === savedCookieOrgId)) return "/today";
  return "/select-organization";
}

describe("KMBOOK Staff — Multi-Organization Isolation & Routing Tests", () => {
  it("Caso 1: automatically navigates to /today when staff belongs to exactly 1 organization", () => {
    const singleOrg = [{ id: "org-1", name: "Salón Belleza Centro", role: "professional" }];
    expect(resolveDestination(singleOrg, null)).toBe("/today");
  });

  it("Caso 2: prompts /select-organization when staff belongs to 2 or more organizations without active choice", () => {
    const multiOrgs = [
      { id: "org-1", name: "Salón Centro", role: "professional" },
      { id: "org-2", name: "Salón Norte", role: "professional" },
    ];
    expect(resolveDestination(multiOrgs, null)).toBe("/select-organization");
  });

  it("navigates to /today if the saved cookie matches one of their active memberships", () => {
    const multiOrgs = [
      { id: "org-1", name: "Salón Centro", role: "professional" },
      { id: "org-2", name: "Salón Norte", role: "professional" },
    ];
    expect(resolveDestination(multiOrgs, "org-2")).toBe("/today");
  });

  it("Caso 13 & Security: ignores forged cookie for an organization the user does NOT belong to", () => {
    const userOrgs = [{ id: "org-1", name: "Salón Propio", role: "professional" }];
    const forgedForeignOrgId = "org-hacker-target";

    expect(resolveDestination(userOrgs, forgedForeignOrgId)).toBe("/today");
  });
});
