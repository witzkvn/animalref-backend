const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const coockieParser = require("cookie-parser");
const globalErrorHandler = require("./controllers/errorController");
const AppError = require("./utils/appError");
const userRouter = require("./routes/userRoutes");
const dataRouter = require("./routes/dataRoutes");

const app = express();
app.enable("trust proxy");

// SECURITY
app.use(helmet({ contentSecurityPolicy: false }));

const limiter = rateLimit({
  max: 300,
  windowMs: 60 * 60 * 1000,
  message:
    "Trop de requêtes depuis votre adresse IP. Merci de réessayer dans une heure :)",
});
// app.use('/api', limiter);
app.use(
  express.json({
    limit: "10kb",
  })
);

// app.use(function (req, res, next) {
//   res.header('Access-Control-Allow-Credentials', true);
//   res.header('Access-Control-Allow-Origin', req.headers.origin);
//   res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,UPDATE,OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
//   next();
// });

app.use(coockieParser(process.env.JWT_SECRET));

app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(mongoSanitize());
app.use(xss());
app.use(
  hpp({
    whitelist: [], // insérer les request params en String ici, exemple 'ratingsAverage', 'ratingsQuantity', 'difficulty', 'price'...
  })
);
app.use(cors());
app.options("*", cors());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(compression());

// ROUTES
app.use("/api/v1/users", userRouter);
app.use("/api/v1/data", dataRouter);

app.use("/", function (req, res) {
  res.send("Bienvenue sur l'API animalRef !");
});

// if request get until here, error
app.all("*", (req, res, next) => {
  next(
    new AppError(
      `Oooops ! L'URL ${req.originalUrl} n'a pas été trouvé sur ce serveur... Merci d'essayer un autre URL.`,
      404
    )
  );
});

// global error handler
app.use(globalErrorHandler);

module.exports = app;
