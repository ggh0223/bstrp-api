var express = require('express');
var router = express.Router();
const models                = require('../models');
const moment = require("moment");

router.get('/', async function(req, res, next) {
	try {
		const filter = await models.Filter.findOne({
			where: {
				id: 1
			},
		});

		res.send(filter);
	} catch (e) {
		next(e);
	}
});


router.post('/', async function(req, res, next) {
	try {
		const [filter, created] = await models.Filter.findOrCreate({
			where: {
				id: 1
			},
			defaults: req.body
		});

		if (!created) {
			await filter.update(req.body);
		}
		res.send('Success');
	} catch (e) {
		next(e);
	}
});

module.exports = router;