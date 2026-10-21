/**
 * Template-create access helpers.
 */

jest.unmock("../shared/template-create-access");

import { userCanCreateProjectsFromTemplates } from "../shared/template-create-access";
import { IPassportSession } from "../interfaces/passport-session";

const session = (partial: Partial<IPassportSession>): IPassportSession =>
  partial as IPassportSession;

describe("template-create-access", () => {
  it("allows Owner", () => {
    expect(
      userCanCreateProjectsFromTemplates(session({ owner: true }))
    ).toBe(true);
  });

  it("allows Admin", () => {
    expect(
      userCanCreateProjectsFromTemplates(session({ is_admin: true }))
    ).toBe(true);
  });

  it("denies Member even when the legacy flag is set", () => {
    expect(
      userCanCreateProjectsFromTemplates(
        session({ can_create_projects_from_templates: true })
      )
    ).toBe(false);
  });

  it("denies Member without flag", () => {
    expect(
      userCanCreateProjectsFromTemplates(
        session({ can_create_projects_from_templates: false })
      )
    ).toBe(false);
  });

  it("denies missing user", () => {
    expect(userCanCreateProjectsFromTemplates(null)).toBe(false);
    expect(userCanCreateProjectsFromTemplates(undefined)).toBe(false);
  });
});
