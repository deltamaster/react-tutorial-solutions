import { getAvatarPath, getSpeakerVoice, VOICE_MAP } from "../avatarUtils";

describe("avatarUtils", () => {
  describe("getAvatarPath", () => {
    it("should return female user avatar for female user", () => {
      expect(getAvatarPath("female", true, null)).toBe("/avatar-user-female.jpg");
    });

    it("should return male user avatar for male user", () => {
      expect(getAvatarPath("male", true, null)).toBe("/avatar-user-male.jpg");
    });

    it("should return default male avatar for user when not specified", () => {
      expect(getAvatarPath("", true, null)).toBe("/avatar-user-male.jpg");
    });

    it("should return Belinda avatar for Belinda role", () => {
      expect(getAvatarPath("male", false, "Belinda")).toBe("/avatar-belinda.jpg");
    });

    it("should return Charlie avatar for Charlie role", () => {
      expect(getAvatarPath("male", false, "Charlie")).toBe("/avatar-charlie.jpg");
    });

    it("should return Diana avatar for Diana role", () => {
      expect(getAvatarPath("male", false, "Diana")).toBe("/avatar-diana.jpg");
    });

    it("should return Adrien avatar as default for unknown roles", () => {
      expect(getAvatarPath("male", false, "Unknown")).toBe("/avator-adrien.jpg");
      expect(getAvatarPath("male", false, null)).toBe("/avator-adrien.jpg");
    });
  });

  describe("getSpeakerVoice", () => {
    it("should return female voice for female user", () => {
      expect(getSpeakerVoice("female", true, null)).toBe(VOICE_MAP.userFemale);
    });

    it("should return male voice for male user", () => {
      expect(getSpeakerVoice("male", true, null)).toBe(VOICE_MAP.userMale);
    });

    it("should return default male voice for user when not specified", () => {
      expect(getSpeakerVoice("", true, null)).toBe(VOICE_MAP.userMale);
    });

    it("should return correct voice for each role", () => {
      expect(getSpeakerVoice("male", false, "Adrien")).toBe(VOICE_MAP.Adrien);
      expect(getSpeakerVoice("male", false, "Belinda")).toBe(VOICE_MAP.Belinda);
      expect(getSpeakerVoice("male", false, "Charlie")).toBe(VOICE_MAP.Charlie);
      expect(getSpeakerVoice("male", false, "Diana")).toBe(VOICE_MAP.Diana);
    });

    it("should return Adrien voice as default for unknown roles", () => {
      expect(getSpeakerVoice("male", false, "Unknown")).toBe(VOICE_MAP.Adrien);
      expect(getSpeakerVoice("male", false, null)).toBe(VOICE_MAP.Adrien);
    });
  });

  describe("VOICE_MAP", () => {
    it("should have all expected voice mappings", () => {
      expect(VOICE_MAP).toHaveProperty("Adrien");
      expect(VOICE_MAP).toHaveProperty("Belinda");
      expect(VOICE_MAP).toHaveProperty("Charlie");
      expect(VOICE_MAP).toHaveProperty("Diana");
      expect(VOICE_MAP).toHaveProperty("userMale");
      expect(VOICE_MAP).toHaveProperty("userFemale");
    });
  });
});
