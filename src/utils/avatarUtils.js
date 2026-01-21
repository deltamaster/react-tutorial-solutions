/**
 * Avatar and voice mapping utilities
 * Centralized configuration for avatar paths and voice selection
 */

/**
 * Voice mapping configuration
 * Maps role names and user avatar types to TTS voice names
 */
export const VOICE_MAP = {
  Adrien: "Ethan",
  Belinda: "Cherry",
  Charlie: "Nofish",
  Diana: "Cherry",
  userMale: "Ryan",
  userFemale: "Katerina",
};

/**
 * Gets the avatar image path for a user or role
 * 
 * @param {string} userAvatar - User avatar preference ("male" or "female")
 * @param {boolean} isUserMessage - Whether this is a user message
 * @param {string} roleName - Role name for bot messages (e.g., "Belinda", "Charlie")
 * @returns {string} - Path to avatar image
 */
export const getAvatarPath = (userAvatar, isUserMessage, roleName) => {
  if (isUserMessage) {
    return userAvatar === "female"
      ? "/avatar-user-female.jpg"
      : "/avatar-user-male.jpg";
  }
  
  // Bot avatars
  switch (roleName) {
    case "Belinda":
      return "/avatar-belinda.jpg";
    case "Charlie":
      return "/avatar-charlie.jpg";
    case "Diana":
      return "/avatar-diana.jpg";
    default:
      return "/avator-adrien.jpg";
  }
};

/**
 * Gets the TTS voice for a user or role
 * 
 * @param {string} userAvatar - User avatar preference ("male" or "female")
 * @param {boolean} isUserMessage - Whether this is a user message
 * @param {string} roleName - Role name for bot messages
 * @returns {string} - Voice name for TTS
 */
export const getSpeakerVoice = (userAvatar, isUserMessage, roleName) => {
  if (isUserMessage) {
    return userAvatar === "female"
      ? VOICE_MAP.userFemale
      : VOICE_MAP.userMale;
  }
  
  return VOICE_MAP[roleName] || VOICE_MAP.Adrien;
};
