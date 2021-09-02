const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError("Aucun document trouvé avec cet ID", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (req?.files?.images) {
      req.body.images = req.files.images;
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError("Aucun document trouvé avec cet ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model, addFieldOptions) =>
  catchAsync(async (req, res, next) => {
    if (req.user && addFieldOptions && addFieldOptions === "user") {
      req.body.user = req.user;
    }

    if (req.files.images) {
      req.body.images = req.files.images;
    }

    const doc = await Model.create(req.body);

    res.status(201).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.getOne = (Model, popOptions, limitFieldsOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id).select(limitFieldsOptions);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError("Aucun document trouvé avec cet ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // pour autoriser nested GET reviews on tour ; uniquement utile pour les reviews
    let filter = {};
    if (req.params.userdatasid) filter = { user: req.params.userdatasid };

    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sorting()
      .limitFields()
      .paginate();

    const countTotalPromise = await new APIFeatures(
      Model.find(filter),
      req.query
    ).filter().query;

    const doc = await features.query;

    res.status(200).json({
      status: "success",
      results: doc.length,
      totalResults: countTotalPromise.length,
      totalPages: Math.ceil(countTotalPromise.length / 50),
      page: req?.query?.page * 1 || 1,
      data: {
        data: doc,
      },
    });
  });
