var express                 = require('express');
var router                  = express.Router();
const models                = require('../models');
const jwt                   = require('jsonwebtoken');
const moment                = require("moment");
const Crypto = require('crypto');
const {Op} = require("sequelize");

router.get('/list', async function (req, res, next) {
    let where = {};
    const { page, limit, startDate, endDate, company_nm, auth, account, owner, all, tab } = req.query;
    if (startDate && endDate) {
        where.createdAt = {
            [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
        }
    } else if (startDate) {
        where.createdAt = {
            [Op.gte]: startDate + " 00:00:00"
        }
    } else if (endDate) {
        where.createdAt = {
            [Op.lte]: endDate + " 23:59:59"
        }
    }
    if (company_nm) {
        where.company_nm = {
            [Op.like]: `%${company_nm}%`
        }
    }
    if (auth) {
        where.auth = {
            [Op.like]: `%${auth}%`
        };
    }
    if (account) {
        where.account = {
            [Op.like]: `%${account}%`
        };
    }
    if (owner) {
        where.owner = {
            [Op.like]: `%${owner}%`
        };
    }
    if (all) {
        const search = [
            { account: { [Op.like]: `%${all}%` } },
            { company_nm: { [Op.like]: `%${all}%` } },
            { auth: { [Op.like]: `%${all}%` } },
            { owner: { [Op.like]: `%${all}%` } },
        ]
        if (where.createdAt) {
            search.map((item) => {
                item.createdAt = where.createdAt;
            });
        }
        where = {
            [Op.or]: search
        }
    }
    if (tab && tab !== "전체") {
        where.auth = tab;
    }
    if (req.user.account !== "admin") {
        const sub_accounts = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
            { type: models.Sequelize.QueryTypes.SELECT }
        )
        where.id = sub_accounts.map((item) => item.id)
    }

    const count = await models.Account.count({
        where: where,
    });

    const user = await models.Account.findAll({
        where: where,
        offset: Number(page) * 10,
        limit: limit ? Number(limit) : 10,
    }).then(user => user.map(user => {
        user = user.toJSON();
        user.createdAt = moment(user.createdAt).format("YYYY-MM-DD HH:mm:ss");
        return user
    }));


    for (let i = 0; i < user.length; i++) {
        let cash_list = [];
        if (user[i].account === "admin") {
            cash_list = await models.Account.findAll();
        } else {
            cash_list = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, cash) AS
                               (SELECT account, owner, cash FROM Accounts WHERE account = '${user[i].account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.cash
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT }
            )
        }
        user[i].createdAt = moment(user[i].createdAt).format("YYYY-MM-DD HH:mm:ss");
        // user[i].cash = cash_list.reduce((acc, cur) => {
        //     return acc + cur.cash;
        // }, 0);
        user[i].ad_cnt = await models.Advertisement.count({
            where: {
                AccountId: user[i].id,
            }
        });
    }

    res.send({list: user, totalCount: count});
});
router.get('/me', async function (req, res, next) {
    try {
        const user = await models.Account.findOne({
            where: { id: req.user.id },
            include: [{
                model: models.Cash,
            }, {
                model: models.Advertisement,
            }]
        }).then(user => user.toJSON());
        const result = {};
        result.id = user.id;
        result.account = user.account;
        result.auth = user.auth;
        result.company_nm = user.company_nm;
        result.cash = user.cash;
        result.owner = user.owner;
        // const cash = user.account !== "admin"
        //     ? await models.sequelize.query(`WITH RECURSIVE cte (account, owner, cash) AS
        //                            (SELECT account, owner, cash FROM Accounts WHERE account = '${user.account}'
        //                                UNION ALL
        //                                SELECT t.account, t.owner, t.cash
        //                                FROM cte c
        //                                JOIN Accounts t
        //                                ON c.account = t.owner)
        //                            SELECT * FROM cte;`,
        //         { type: models.Sequelize.QueryTypes.SELECT }
        //     )
        //     : await models.Account.findAll().then(accounts => accounts.map((item) => item.toJSON()));
        // result.cash = cash.reduce((acc, cur) => {
        //     return acc + cur.cash;
        // }, 0);
        if (user.auth === "관리자") {
            result.owner_option = await models.Account.findAll({
                where: {
                    auth: ["관리자", "0차총판", "대행사", "매체사"],
                }
            }).then(user => user.map(user => user.account));
        } else {
            result.owner_option = [user.account];
        }
        res.json(result);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/media_option', async function (req, res, next) {
    try {
        const result = await models.Account.findAll({
            where: {
                auth: "매체사",
            }
        }).then(accounts => accounts.map((item) => item.toJSON()));
        res.json(result);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.post('/', async function (req, res, next) {
    try {
        let store_key = Crypto.randomBytes(16).toString('base64').slice(0, 16);
        const user = await models.Account.create(Object.assign(req.body, {store_key: store_key}));

        let owner = ["admin"];
        if (user.owner !== "admin") {
            owner.push(user.owner);
        }
        while (owner.length > 0) {
            const account = await models.Account.findOne({
                where: { account: owner.pop() },
            });
            account.mng_acc_cnt += 1;
            await account.save();
            if (account.owner !== "admin") {
                owner.push(account.owner);

            }
        }

        res.json({ message: '등록되었습니다.' });
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.put('/:id', function (req, res, next) {
    models.Account.update(req.body, {
        where: { id: req.params.id }, returning: true,
    }).then(user => {
        res.json({ message: '수정되었습니다.' });
    });
});
router.delete('/:id', async function (req, res, next) {
    try {
        const id = req.params.id;
        const user = await models.Account.findOne({
            where: { id: id },
        }).then(user => user.toJSON());
        const account = user.account;
        let owner = ["admin"];
        if (user.owner !== "admin") {
            owner.push(user.owner);
        }
        while (owner.length > 0) {
            const account = await models.Account.findOne({
                where: { account: owner.pop() },
            });
            account.mng_acc_cnt -= 1;
            await account.save();
            if (account.owner !== "admin") {
                owner.push(account.owner);
            }
        }
        const deletedAccount = account + `_deleted_${id}`
        await models.Account.update({
            account: deletedAccount,
        }, {
            where: { id: id },
        });
        await models.Account.update({
            owner: deletedAccount,
        }, {
            where: { owner: account },
            paranoid: false,
        });
        await models.CashHistory.destroy({
            where: {
                AccountId: id,
            }
        });
        await models.Account.destroy({
            where: { id: id }
        });
        res.json({ message: '삭제되었습니다.' });
    } catch (e) {
        console.log(e);
        next(e);
    }
});

module.exports = router;
