const mongoose = require("mongoose");
const dotenv = require("dotenv");

// catch exception error and close app
process.on("uncaughtException", (err) => {
  console.log("Uncaught exception. Shutting down...");
  console.log(err.name, err.message);
  process.exit(1); // fermer toute l'app
});

dotenv.config({ path: "./config.env" });

const app = require("./app");

const DB = process.env.DATABASE.replace(
  "<password>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(() => console.log("Connexion with DB done. Listening to requests..."));

const port = process.env.PORT || 3001;
const server = app.listen(port, () => {
  console.log(`App running on port ${port} ...`);
});

process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection. Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    // close server
    process.exit(1); // close entire app
  });
});

process.on("SIGTERM", () => {
  console.log("SIGTERM RECEIVED. Shutting down...");
  server.close(() => {
    // fermer serveur pour finir les requêtes en cours
    console.log("Process terminated!");
    process.exit(1); // fermer toute l'app
  });
});
