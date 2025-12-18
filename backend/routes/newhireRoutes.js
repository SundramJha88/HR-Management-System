const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const newhireController = require('../controllers/newhireController');
const checkRole = require('../middleware/roleCheck');

router.post('/submit', auth, checkRole(['admin','hr']), newhireController.submit);
router.get('/history', auth, newhireController.getHistory);
router.get('/all', auth, checkRole(['admin','hr']), newhireController.listAll);
router.get('/:id', auth, checkRole(['admin','hr']), newhireController.getById);
router.put('/:id', auth, checkRole(['admin','hr']), newhireController.update);
router.delete('/:id', auth, checkRole(['admin','hr']), newhireController.delete);
router.get('/by-employee/:employeeId', auth, checkRole(['admin','hr']), newhireController.getByEmployeeId);
router.put('/by-employee/:employeeId', auth, checkRole(['admin','hr']), newhireController.updateByEmployeeId);

module.exports = router;
