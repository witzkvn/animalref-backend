const crypto = require("crypto");
const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const validatePassword = require("../utils/validatePassword");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Merci de fournir un nom."],
  },
  email: {
    type: String,
    validate: [validator.isEmail, "Merci de fournir un email valide."],
    required: [true, "Merci de fournir un email."],
    unique: true,
    lowercase: true,
  },
  avatar: {
    type: String,
    // default: 'default.jpg'
  },
  favorites: {
    type: Array,
  },
  settings: {
    theme: {
      type: String,
      enum: ["dark", "light"],
      default: "light",
    },
    mainColor: {
      type: String,
    },
  },
  role: {
    type: String,
    enum: ["moderator", "user", "admin"],
    default: "user",
  },
  password: {
    type: String,
    required: [true, "Merci de fournir un mot de passe."],
    minlength: [
      8,
      "Votre mot de passe doit faire au moins 8 caractères de long.",
    ],
    select: false,
    validate: {
      validator: function (password) {
        const regexRule =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regexRule.test(password);
      },
      message:
        "Le mot de passe doit faire au moins 8 caractères de long, avec une majuscule, une minuscule, un nombre et un caractère spécial (@$!%*?&).",
    },
  },
  passwordConfirm: {
    type: String,
    required: [true, "Merci de confirmer votre mot de passe."],
    validate: {
      // ne fonctionne que en CREATE ou SAVE !
      validator: function (val) {
        return val === this.password;
      },
      message:
        "la confirmation du mot de passe ne correspond pas au mot de passe.",
    },
  },
  passwordChangedAt: Date,
  passwordresetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

//######## SCHEMA MIDDLEWARES

// if password changed, encrypt new password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // passwordConfirm not saved in DB
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // JWT creation delay
  next();
});

// before any find, reject all not active users
userSchema.pre(/^find/, function (next) {
  // this = current query
  this.find({ active: { $ne: false } });
  // this.select('-__v')
  next();
});

//######## INSTANCE METHODS

// check if password matches user's password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// check if user changed password recently and his JWT is not valid anymore
userSchema.methods.changedPasswordAfter = async function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimeStamp;
  }
  return false;
};

// generate a 10 min valid token to allow password change
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex"); // encrypt reset token
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min
  return resetToken;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
