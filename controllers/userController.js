const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const factory = require("./handlerFactory");
const filterObj = require("../utils/checkAllowedUpdateFields");

// multer config for avatar upload
const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "The uploaded file is not an image or is over 3MB. Please upload a valid image.",
        400
      ),
      false
    );
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 1024 * 1024 * 3,
  },
});

exports.uploadUserAvatar = upload.single("avatar");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// DB image storage on cloudinary
exports.resizeUserAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  // must set filename on the req to get it in updateMe
  const uniqueFileName = `user-${req.user.id}-${Date.now()}`;

  let result = await uploadFromBuffer(req, uniqueFileName);
  req.file.filename = result.secure_url;

  next(); // next middleware is updateMe
});

let uploadFromBuffer = (req, uniqueFileName) => {
  return new Promise((resolve, reject) => {
    let cld_upload_stream = cloudinary.uploader.upload_stream(
      {
        public_id: `avatar/${uniqueFileName}`,
        tags: "avatar",
        transformation: {
          width: 300,
          height: 300,
          crop: "fit",
          format: "jpg",
          quality: "auto",
        },
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
  });
};

//######## SPECIFIC ROUTES

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id; // set user id as params, then call getOne with the user id
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) block password update
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'Cette route nest pas destinée à la modification du mot de passe. Merci d\'utiliser "/updateMyPassword".',
        400
      )
    );
  }
  // 2) check valid update fields and update
  if (req.body.settings && typeof req.body.settings !== "object")
    return next(
      new AppError(
        "Merci d'envoyer un objet valide pour la mise à jour de ces champs.",
        400
      )
    );

  const filteredBody = filterObj(req.body, "name", "email", "settings"); // update fields allowed starting as 2nd params

  if (req.file) filteredBody.avatar = req.file.filename;

  if (filteredBody && Object.keys(filteredBody).length === 0) {
    return next(
      new AppError(
        "Aucun élément de la requête n'est autorisé à être modifié. Merci de vérifier votre requête.",
        403
      )
    );
  }

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  // deleting account = passing active to false
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// create not allowed for users, the route is signup
exports.createUser = (req, res) => {
  res.status(500).json({
    status: "error",
    message: "Merci d'utiliser la route /signup pour créer un nouveau compte !",
  });
};

//######## GENERIC ROUTES

exports.deleteUser = factory.deleteOne(User);
exports.getUser = factory.getOne(User, null, "avatar name +__v");
exports.getAllUsers = factory.getAll(User);
// Do NOT update password with this !
exports.updateUser = factory.updateOne(User);
