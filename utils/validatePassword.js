// Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character:
const validatePassword = (password) => {
  const regexRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regexRule.test(password)
}

module.exports = validatePassword;