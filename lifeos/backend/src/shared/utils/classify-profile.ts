const professionKeywords: Record<string, string[]> = {
  DENTIST: ["dentist", "dental", "clinic", "odont"],
  REALTOR: ["realtor", "real estate", "property", "broker"],
  HAIRDRESSER: ["hair", "barber", "beauty salon", "stylist"],
  LAWYER: ["lawyer", "attorney", "legal"],
  CONSULTANT: ["consultant", "advisory", "strategy"],
  COACH: ["coach", "mentoring"],
  CREATOR: ["content", "creator", "influencer", "social media"]
};

export const classifyProfessionalProfile = (input?: string): string => {
  if (!input || input.trim().length === 0) {
    return "GENERAL_PROFESSIONAL";
  }

  const normalized = input.toLowerCase();

  for (const [profile, keywords] of Object.entries(professionKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return profile;
    }
  }

  return "GENERAL_PROFESSIONAL";
};
