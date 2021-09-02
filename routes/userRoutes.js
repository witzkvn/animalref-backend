const express = require('express')
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup)
router.post('/login', authController.login)
router.get('/logout', authController.logout)

router.post('/forgotPassword', authController.forgotPassword)
router.patch('/resetPassword/:token', authController.resetPassword)

router.use(authController.protect);
// All routes below are protected : need to be logged to gain access

router.get('/me', userController.getMe, userController.getUser)

router.patch('/updateMyPassword', authController.updatePassword)
router.patch('/updateMe', userController.uploadUserAvatar, userController.resizeUserAvatar, userController.updateMe)
router.delete('/deleteMe', userController.deleteMe)

router.get('/:id', userController.getUser)

router.use(authController.restrictTo('admin')) // only admins will be able to use routes below : 

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser)

router
  .route('/:id')
  .patch(userController.updateUser)
  .delete(userController.deleteUser)



module.exports = router;