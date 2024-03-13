var express                 = require('express');
var router                  = express.Router();
const models                = require('../models');
const jwt                   = require('jsonwebtoken');
const moment                = require("moment");

router.post('/login', function (req, res, next) {
    models.Account.findOne({ where: { account: req.body.user_id
    } }).then(user => {
        if (!user) {
            res.json({ message: '없는 사용자입니다.' });
        } else {
            // if (user.comparePassword(req.body.password)) {
            if (user.password === req.body.password) {
                const payload = user.toJSON();
                jwt.sign(payload, process.env.secret, (err, token) => {
                    if (err) console.log(err);
                    res.json({
                        message: "success", token: token, user: user,
                    });
                });
            } else {
                res.json({ message: '비밀번호가 일치하지 않습니다.' });
            }
        }
    }).catch(err => {
        console.log(err);
        res.json({ message: '없는 사용자입니다.' });
    });
});




router.get('/valid-token', async function(req, res, next) {
    const token = await models.AccessToken.findOne({where:{uuid:req.query.token}});
    if(token){

        if (moment().isAfter(token.expiredAt)) {
            return res.json({ status: "already_expired", token_id: token.id });
        } else {
            return res.json({ status: "valid_token", token_id: token.id });
        }

    } else {
        return res.json({ status: "invalid_token" });
    }
});

module.exports = router;