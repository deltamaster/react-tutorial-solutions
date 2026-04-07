import {
  getToolsForRole,
  adrienOneDriveConversationDeclarations,
  adrienBaseFunctionDeclarations,
} from "../roleConfig";

describe("getToolsForRole", () => {
  it("Adrien (general) without OneDrive exposes only memory tools", () => {
    const t = getToolsForRole("general", { isOneDriveAvailable: false });
    expect(t.function_declarations).toHaveLength(adrienBaseFunctionDeclarations.length);
  });

  it("Adrien (general) with OneDrive adds saved-conversation tool declarations", () => {
    const t = getToolsForRole("general", { isOneDriveAvailable: true });
    expect(t.function_declarations).toHaveLength(
      adrienBaseFunctionDeclarations.length + adrienOneDriveConversationDeclarations.length
    );
  });
});
