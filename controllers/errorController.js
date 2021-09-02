const AppError = require("../utils/appError");

// HELPER FUNCTIONS

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path} : ${err.value}.`;
  return new AppError(message, 400);
};
const handleJWTError = () =>
  new AppError("Invalid token. Please login again.", 401);
const handleJWTExpired = () =>
  new AppError("Token expired. Please login again.", 401);

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue.name;
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err, req, res) => {
  // API
  if (req.originalUrl.startsWith("/api")) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
};

const sendErrorProd = (err, req, res) => {
  // APIs error
  if (req.originalUrl.startsWith("/api")) {
    // If operational error : send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: "error",
        message: err.message,
      });
    }
    // if programming or other error : don't leak error details
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: "error",
      message: "Please try again later.",
    });
  }
  // if programming or other error : don't leak error details
  return res.status(err.statusCode).json({
    status: "error",
    message: "Please try again later.",
  });
};

// ERROR HANDLER
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500; // internal server error by default, code 500
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    error.name = err.name;
    error.message = err.message;

    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    // si plusieurs messages d'erreur on va aussi regrouper les textes
    if (error._message === "Data validation failed")
      error = handleValidationErrorDB(error);

    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpired();

    sendErrorProd(error, req, res);
  }
};
