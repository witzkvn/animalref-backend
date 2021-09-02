const { promisify } = require("util");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Email = require("../utils/email");

// create a unique signature with the jwtSecret
const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createAndSendToken = (user, statusCode, req, res) => {
  // create unique signed jwt
  const token = signToken(user._id);

  // cookie expire 90 days
  res.cookie("jwt", token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });

  // remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: user,
    },
  });
};

// delete jwt in front
exports.logout = (req, res) => {
  res.cookie("jwt", "logged out", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

exports.signup = catchAsync(async (req, res, next) => {
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser)
    return next(
      new AppError(
        "Il existe déjà un compte avec cet email. Merci de vous connecter ou d'utiliser un autre email.",
        400
      )
    );

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    // role: req.body.role
  });

  // const url = `${req.protocol}://${req.get('host')}/me`;
  const url = "https://www.google.com";
  await new Email(newUser, url).sendWelcome();

  createAndSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) email et password exist ?
  if (!email || !password) {
    return next(
      new AppError("Merci de fournir un email et un mot de passe.", 400)
    );
  }

  // 2) check if user's password is correct ? WARNING : password was excluded from Model. Must specified that we select it here
  const user = await User.findOne({ email: email }).select("+password");

  // check password with model instance method
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Email ou mot de passe incorrect.", 401));
  }

  // 3) if all OK, send token
  createAndSendToken(user, 200, req, res);
});

//########## PROTECT ROUTES TO ONLY LOGGED IN USERS
exports.protect = catchAsync(async (req, res, next) => {
  // 1) get token and check if exist
  // token header authorization example : 'Bearer jsdokdsdsjdsdk',
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req?.cookies?.jwt) {
    token = req.headers.jwt;
  }

  if (!token) {
    return next(
      new AppError(
        "Vous devez être connecté pour accéder à cette requête.",
        401
      )
    );
  }

  // 2) verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // returns decoded JWT like : { id: '5fd5df06635fdc4154935ce5', iat: 1607851782, exp: 1615627782 }

  // 3) check if user still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(
      new AppError("L'utilisateur associé à ce token n'existe plus.", 401)
    );

  // 4) check if user changed password after the JWT was issued with model instance method
  if (await currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "L'utilisateur a récemment changé de mot de passe. Merci de vous reconnecter !",
        401
      )
    );
  }

  // if all OK, return the user object in the query and set it as local variable in response
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.onlyUserDoc = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findById(req.params.id);

    if (!doc) {
      return next(new AppError("Aucun document trouvé avec cet ID.", 404));
    }

    if (
      !(
        doc.user._id &&
        req.user._id &&
        doc.user._id.toString() === req.user._id.toString()
      )
    ) {
      return next(
        new AppError(
          "Vous n'avez pas la permission d'accéder à ce document.",
          403
        )
      );
    }

    next();
  });

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles array, ex ['admin', 'moderator']
    // middleware protect that run before in pipeline set req.user, that is then accessible

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "Vous n'avez pas la permission d'effectuer cette action.",
          403
        )
      );
    }
    next();
  };
};

exports.onlyUserDoc = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findById(req.params.id);

    if (!doc) {
      return next(new AppError("Aucun document trouvé avec cet ID", 404));
    }

    if (
      !(
        doc.user._id &&
        req.user._id &&
        doc.user._id.toString() === req.user._id.toString()
      )
    ) {
      return next(
        new AppError(
          "Vous n'avez pas la permission de manipuler ce document.",
          403
        )
      );
    }

    next();
  });

//########## FORGOT AND RESET PASSWORD

// for not logged in users
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new AppError("Aucun utilisateur n'a été trouvé avec cet email.", 404)
    );
  }

  // 2) generate the random reset JWT with model instance method
  const resetToken = user.createPasswordResetToken(); // add resetToken and resetTokenExpiresIn to document
  await user.save({ validateBeforeSave: false }); // save document with these new fields

  // 3) send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;
  const message = `Vous avez oublié votre mot de passe ? Envoyez une requête PATCH avec votre nouveau mot de passe, et la confirmation de votre mot de passe à : ${resetURL}. Si vous n'avez pas oublié votre mot de passe, ignorez ce message !`;

  try {
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: "success",
      message: "Token envoyé à l'adresse email.",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "Une erreur est survenue durant l'envoi de l'email. Merci de réessayer plus tard ! ",
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex"); // encrypt token to compare it to the one in the DB

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }); // find user with valid resetToken

  if (!user) {
    return next(new AppError("Token invalide ou expiré.", 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // let validator check (for all fields, here to check password and passwordConfirm match)

  // 3) update changedPasswordAt (pre save middleware in User Model)

  // 4) log user in, send JWT
  createAndSendToken(user, 200, req, res);
});

// For logged in user :
exports.updatePassword = catchAsync(async (req, res, next) => {
  // need to give current password, new password and confirm new password in body
  // 1) get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Votre mot de passe actuel est incorrect.", 401));
  }

  // 3) if ok, update
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save(); // findByIDandUpdate does not work (blocked)

  // 4) log user in, send JWT
  createAndSendToken(user, 200, req, res);
});
