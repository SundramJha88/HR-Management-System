const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const newhireController = require('../controllers/newhireController');

router.post('/submit', auth, newhireController.submit);
router.get('/history', auth, newhireController.getHistory);
router.get('/:id', auth, newhireController.getById);
router.put('/:id', auth, newhireController.update);
router.delete('/:id', auth, newhireController.delete);

module.exports = router;
