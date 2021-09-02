const express = require("express");
const authController = require("../controllers/authController");
const dataController = require("../controllers/dataController");
const Data = require("../models/dataModel");

const router = express.Router();

router
  .route("/")
  .get(dataController.getAllDatas)
  .post(
    dataController.uploadDataImages,
    dataController.resizeDataImages,
    dataController.createData
  );

router.route("/:id").get(dataController.getData);

// all routes below are protected - needs to be logged in to access
router.use(authController.protect);

router.route("/fav").get(dataController.getUserFavDatas);

router.route("/fav/:id").get(dataController.toggleFavoriteData);

router.route("/user/:userdatasid").get(dataController.getAllDatas);

// all routes below have doc protection : requester can only manipulate his own documents with onlyUserDoc()
router
  .route("/modify/:id")
  .patch(
    authController.onlyUserDoc(Data),
    dataController.uploadDataImages,
    dataController.resizeDataImages,
    dataController.updateData
  );

router
  .route("/delete/:id")
  .delete(authController.onlyUserDoc(Data), dataController.deleteData);

module.exports = router;
