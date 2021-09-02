const factory = require("./handlerFactory");
const Data = require("../models/dataModel");
const catchAsync = require("../utils/catchAsync");
const streamifier = require("streamifier");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const User = require("../models/userModel");
const APIFeatures = require("../utils/apiFeatures");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  // test for files type
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Les fichiers envoyés ne sont pas de type image. Merci d'envoyer des images.",
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
    fileSize: 1024 * 1024 * 5,
  },
});

exports.uploadDataImages = upload.fields([
  {
    name: "images",
    maxCount: 3,
  },
]);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.resizeDataImages = catchAsync(async (req, res, next) => {
  if (!req?.files?.images) return next();

  // must set filename on the req to get it in updateMe
  let imagesUrlArray = [];
  const dateNow = Date.now();

  await Promise.all(
    req.files.images.map(async (img, index) => {
      const uniqueFileName = `Data-${req.user.id}-${dateNow}-${index}`;
      try {
        let result = await uploadFromBuffer(
          img.buffer,
          req.user.id,
          uniqueFileName
        );
        await imagesUrlArray.push(result.secure_url);
      } catch (error) {
        console.log(error.response);
        throw error;
      }
    })
  );

  req.files.images = [...imagesUrlArray];

  next(); // next middleware is updateMe
});

let uploadFromBuffer = (buffer, userId, uniqueFileName) => {
  return new Promise((resolve, reject) => {
    let cld_upload_stream = cloudinary.uploader.upload_stream(
      {
        public_id: `data/${userId}/${uniqueFileName}`,
        tags: "data",
        transformation: { format: "jpg", quality: "auto" },
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(cld_upload_stream);
  });
};

exports.toggleFavoriteData = catchAsync(async (req, res, next) => {
  const dataId = req.params.id;
  const userFavs = req.user.favorites;
  const existingData = userFavs.indexOf(dataId);
  console.log(dataId, userFavs, existingData);

  if (existingData === -1) {
    userFavs.push(dataId);
  } else if (existingData >= 0) {
    userFavs.splice(existingData, 1);
  }
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      favorites: [...userFavs],
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: "success",
    data: {
      data: updatedUser,
    },
  });
});

exports.getUserFavDatas = catchAsync(async (req, res, next) => {
  if (!req.user.favorites || req.user.favorites.length === 0) {
    res.status(200).json({
      status: "success",
      data: {
        data: null,
      },
    });
  }

  const userFavIds = req.user.favorites;

  const favDatas = new APIFeatures(
    Data.find({ _id: { $in: [...userFavIds] } })
  ).paginate();
  const doc = await favDatas.query;

  res.status(200).json({
    status: "success",
    results: doc.length,
    totalPages: Math.ceil(doc.length / 15),
    page: req?.query?.page * 1 || 1,
    data: {
      data: doc,
    },
  });
});

exports.createData = factory.createOne(Data, "user");
exports.deleteData = factory.deleteOne(Data);
// exports.getData = factory.getOne(Data, { path: 'reviews' });
exports.getData = factory.getOne(Data, { path: "user" });
exports.getAllDatas = factory.getAll(Data);
// exports.getAllUserDatas = factory.getAll(Data);
exports.updateData = factory.updateOne(Data);
