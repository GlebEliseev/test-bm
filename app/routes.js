'use strict';

const Router = require('koa-router');
const homeController = require('./controllers/home');



const router = new Router();
router.get('/', homeController.getPoll);
router.post('/create', homeController.makePoll);
router.post('/poll/:pollId', homeController.vote);

router.get('/user', homeController.getUserPoll);
router.get('/close', homeController.closePoll);

module.exports = router;
