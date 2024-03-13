var express = require('express');
var router = express.Router();
const models                = require('../models');
const moment = require("moment");
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/api/manual', async function(req, res, next) {

  res.send('Success');
});

module.exports = router;
