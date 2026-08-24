class CommonUtil {
  /**
   * Parses a string in the format "First Last <email@example.com>"
   * @param {string} input 
   * @returns {Object|null} { firstName, lastName, email }
   */
  static parseContactInfo(input) {
    if (!input || typeof input !== 'string') return null;

    // Regex to capture Name and Email inside < >
    const regex = /^(.*?)\s*<(.*?)>/;
    const match = input.match(regex);

    if (match) {
      const fullName = match[1].trim();
      const email = match[2].trim();

      // Split name into parts to separate First and Last
      const nameParts = fullName.split(/\s+/); // Handles multiple spaces
      const firstName = nameParts[0] || '';
      
      // Joins everything else as the last name (handles middle names)
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      return {
        firstName,
        lastName,
        email
      };
    }

    // Fallback if format doesn't have < >
    return null;
  }

  /**
   * You can add other shared utilities here later
   * Example: static formatDate(date) { ... }
   */
}

module.exports = CommonUtil;