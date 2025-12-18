const router = require("express").Router();
const auth = require("../middleware/auth");
const checkRole = require("../middleware/roleCheck");
const adminController = require("../controllers/adminController");

router.get("/users", auth, checkRole(["admin"]), adminController.getAllUsers);
router.get("/users/:id", auth, checkRole(["admin"]), adminController.getUserById);
router.put("/users/:id", auth, checkRole(["admin"]), adminController.updateUser);
router.put("/users/:id/status", auth, checkRole(["admin"]), adminController.updateUserStatus);
router.delete("/users/:id", auth, checkRole(["admin"]), adminController.deleteUser);
router.get("/stats", auth, checkRole(["admin"]), adminController.getUsersStats);
router.get("/attendance-report", auth, checkRole(["admin","hr"]), adminController.getAttendanceReport);
router.get("/leave-report", auth, checkRole(["admin","hr"]), adminController.getLeaveReport);

module.exports = router;
