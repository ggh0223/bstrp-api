var express                 = require('express');
var router                  = express.Router();
const models                = require('../models');
const jwt                   = require('jsonwebtoken');
const moment                = require("moment");
const {Op} = require("sequelize");
const excel = require("exceljs");

router.get('/list', async function (req, res, next) {
    const { page, limit, startDate, endDate,
        company_nm, depositor_nm, account, all } = req.query;
    const where = {};
    if (startDate && endDate) {
        where.created_at = {
            [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
        }
    } else if (startDate) {
        where.created_at = {
            [Op.gte]: startDate + " 00:00:00"
        }
    } else if (endDate) {
        where.created_at = {
            [Op.lte]: endDate + " 23:59:59"
        }
    }
    if (company_nm) where.company_nm = { [Op.like]: `%${company_nm}%` };
    if (depositor_nm)  where.depositor_nm = {[Op.like]: `%${depositor_nm}%`};
    if (account) where.account = { [Op.like]: `%${account}%` };
    if (all) {
        const search = [
            { account: { [Op.like]: `%${all}%` } },
            { company_nm: { [Op.like]: `%${all}%` } },
            { depositor_nm: { [Op.like]: `%${all}%` } },
        ]
        if (where.created_at) {
            search.map((item) => {
                item.created_at = where.created_at;
            });
        }
        where[Op.or] = search;
    }

    if (req.user.account !== "admin") {
        let owners = [];
        for (let i = 0; i < 3; i++) {
            owners = await models.Account.findAll({
                where: {
                    owner: owners.length > 0 ? owners.map(owner => owner.account) : req.user.account
                },
                attributes: ['id', 'account'],
                order: [['createdAt', 'DESC']],
            }).then(accounts => accounts.map((item) => item.toJSON()));
        }
        owners.push({ id: req.user.id, account: req.user.account });
        if (owners.length > 0) {
            where.AccountId = owners.map(owner => owner.id);
        }
    }
    const count = await models.Cash.count({
        where: where,
    });
    const cash = await models.Cash.findAll({
        where: where,
        include: {
            model: models.Account,
            attributes: ['account'],
        },
        order: [['createdAt', 'DESC']],
        offset: Number(page) * Number(limit) ?? 10,
        limit: limit ? Number(limit) : 10,
    }).then(cash => {
        cash = cash.map(cash => cash.toJSON());
        cash.forEach((item, idx) => {
            item.no = Number(page) * 10 + idx + 1;
        });
        return cash;
    }).catch(e => console.log(e));
    res.send({list: cash, totalCount: count});
});
router.get('/adjustment', async function (req, res, next) {
    const { page, limit, startDate, endDate,
        company_nm, depositor_nm, account, owner, all } = req.query;

    const where = {
        cancel_dt: null
    };
    if (startDate && endDate) {
        where.apply_dt = {
            [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
        }
    } else if (startDate) {
        where.apply_dt = {
            [Op.gte]: startDate + " 00:00:00"
        }
    } else if (endDate) {
        where.apply_dt = {
            [Op.lte]: endDate + " 23:59:59"
        }
    }
    if (company_nm) where.company_nm = { [Op.like]: `%${company_nm}%` };
    if (depositor_nm)  where.depositor_nm = {[Op.like]: `%${depositor_nm}%`};
    if (account) where.account = { [Op.like]: `%${account}%` };
    if (owner) where.owner = { [Op.like]: `%${owner}%` };
    if (all) {
        const search = [
            { account: { [Op.like]: `%${all}%` } },
            { owner: { [Op.like]: `%${all}%` } },
            { company_nm: { [Op.like]: `%${all}%` } },
            { depositor_nm: { [Op.like]: `%${all}%` } },
        ]
        if (where.created_at) {
            search.map((item) => {
                item.created_at = where.created_at;
            });
        }
        where[Op.or] = search;
    }

    const count = await models.Cash.count({
        where: where,
    });

    const cash = await models.Cash.findAll({
        where: where,
        include: {
            model: models.Account,
            attributes: ['account'],
        },
        order: [['createdAt', 'DESC']],
        offset: Number(page) * 10,
        limit: limit ? Number(limit) : 10,
    }).then(cash => {
        cash = cash.map(cash => cash.toJSON());
        cash.forEach((item, idx) => {
            item.no = Number(page) * 10 + idx + 1;
        });
        return cash;
    });
    res.send({list: cash, totalCount: count});
});
router.get('/useList', async function (req, res, next) {
   try {
         const { page, limit, startDate, endDate,
             prd_type, company_nm, ad_company_nm, pid, mid, account, status, all } = req.query;
         const process_status_list = {
             "진행전": "PENDING",
             "진행중": "IN_PROGRESS",
             "일시정지": "PAUSED",
             "진행완료": "COMPLETED",
             "취소됨": "CANCELED",
             "PENDING": "진행전",
             "IN_PROGRESS": "진행중",
             "PAUSED": "일시정지",
             "COMPLETED": "진행완료",
             "CANCELED": "취소됨",
         }
         const where = {};
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

         if (company_nm) where.company_nm = { [Op.like]: `%${company_nm}%` };
         if (ad_company_nm) where.ad_company_nm = { [Op.like]: `%${ad_company_nm}%` };
         if (pid) where.pmid = { [Op.like]: `%${pid}%` };
         if (mid) where.pmid = { [Op.like]: `%${mid}%` };
         if (account) where.account = { [Op.like]: `%${account}%` };
         if (prd_type) where.prd_type = { [Op.like]: `%${prd_type}%` };
         // if (status) where['$Advertisement.process_status$'] = { [Op.like]: `%${process_status_list[status]}%` };
         if (all) {
             const search = [
                 { account: { [Op.like]: `%${all}%` } },
                 { company_nm: { [Op.like]: `%${all}%` } },
                 { ad_company_nm: { [Op.like]: `%${all}%` } },
                 { pmid: { [Op.like]: `%${all}%` } },
                 // { mid: { [Op.like]: `%${all}%` } },
                 { prd_type: { [Op.like]: `%${all}%` } },
                 // { ['$Advertisement.process_status$']: { [Op.like]: `%${process_status_list[all]}%` } },
             ]
             if (where.createdAt) {
                 search.map((item) => {
                     item.createdAt = where.createdAt;
                 });
             }
             where[Op.or] = search;
         }

       if (req.user.account !== "admin") {
           let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
               { type: models.Sequelize.QueryTypes.SELECT }
           )
           where.AccountId = owners.map(owner => owner.id);
       }

         // let count = await models.CashHistory.count({
         //     where: where,
         //     include: [{
         //         model: models.Cash,
         //     }, {
         //         model: models.Advertisement,
         //         attributes: ['process_status'],
         //     }],
         // });

       let cash = await models.CashHistory.findAll({
           where: where,
           include: [{
               model: models.Cash,
           }, {
               model: models.Advertisement,
               attributes: ['process_status', 'strt_dt', 'end_dt'],
           }],
           order: [['createdAt', 'DESC']],
           // offset: Number(page) * 10,
           // limit: limit ? Number(limit) : 10,
       }).then(cash => {
           cash = cash.map(cash => cash.toJSON());
           cash.forEach((item, idx) => {
               if (item.Advertisement) {
                   if (item.status && item.status === "PAUSED") {
                       item.status = process_status_list[item.status];
                   } else {
                       item.status = process_status_list[item.Advertisement.process_status];
                       if (item.Advertisement.deletedAt) {
                           item.status = "취소됨";
                       }
                   }
               } else {
                   item.status = item.deposit_status === "취소" ? "충전취소" : item.deposit_status;
               }


               item.date = moment(item.updatedAt).format('YYYY-MM-DD HH:mm:ss');
               if (item.status === "진행중") {
                   item.date = moment(item.Advertisement.strt_dt).format('YYYY-MM-DD HH:mm:ss')
               } else if (item.status === "진행완료") {
                   item.date = moment(item.Advertisement.end_dt).format('YYYY-MM-DD HH:mm:ss')
               }
           });
           return cash;
       });

       const offset = Number(page) * 10;
       let length = limit ? Number(limit) : 10
       let count = cash.length;
       if (status !== "전체") {
           cash = cash.filter(item => item.status === status);
           count = cash.length;
       }
       console.log(count, offset, length)
       if (offset + length > cash.length) {
           length = cash.length;
       }
       cash = cash.slice(offset, offset + length);

       res.send({list: cash, totalCount: count});
   } catch (e) {
       console.log(e)
   }
});
router.post('/', async function (req, res, next) {
    try {
        const created = await models.Cash.create({
            ...req.body,
            company_nm: req.user.company_nm,
            account: req.user.account,
            owner: req.user.owner,
            apply_dt: moment().format('YYYY-MM-DD HH:mm:ss'),
            AccountId: req.user.id,
        });
        await models.CashHistory.create({
            account: req.user.account,
            company_nm: req.user.company_nm,
            cash: req.body.amount,
            current_cash: req.user.cash,
            depositor_nm: req.body.depositor_nm,
            deposit_status: created.deposit_status,
            AccountId: req.user.id,
            CashId: created.id,
        });
        res.json({ message: '등록되었습니다.' });
    } catch (e) {
        console.log(e)
        next(e);
    }
});
router.patch('/:id', async function (req, res, next) {
    try {
        if (req.body.deposit_status) {
            const cash = await models.Cash.findOne({
                where : {
                    id: req.params.id
                }
            })
            const account = await models.Account.findOne({
                where: { id: cash.AccountId },
            });
            if (req.body.deposit_status === "충전완료") {
                account.cash += cash.amount;
                await account.save();
            } else if (cash.deposit_status === "충전완료" &&
                (req.body.deposit_status === "취소" || req.body.deposit_status === "충전대기")) {
                account.cash -= cash.amount;
                await account.save();
            }
            // 정산 취소시 광고 일시정지
            if (req.body.deposit_status === "취소") {
                let currentCash = account.cash;
                const ads = await models.Advertisement.findAll({
                    where: { AccountId: account.id },
                    order: [['createdAt', 'DESC']],
                });
                for (let i = 0; i < ads.length; i++) {
                    const ad = ads[i];
                    const totalCost = ad.ad_unit_price * ad.limit_total;
                    if (currentCash < totalCost) {
                        ad.aprv_status = false;
                        ad.process_status = "PAUSED";
                        await ads[i].save();
                        currentCash += totalCost;
                    } else {
                        break;
                    }
                }
            }
        }
        await models.Cash.update(req.body, {
            where: { id: req.params.id }, returning: true,
        });

        // 히스토리 등록
        if (req.body.deposit_status) {
            const cash = await models.Cash.findOne({
                where : {
                    id: req.params.id
                },
                include: {
                    model: models.Account,
                }
            });
            const history = {
                account: cash.Account.account,
                company_nm: cash.Account.company_nm,
                current_cash: cash.Account.cash,
                depositor_nm: cash.depositor_nm,
                deposit_status: cash.deposit_status,
                AccountId: cash.AccountId,
                CashId: cash.id,
            }
            switch (cash.deposit_status) {
                case "충전대기":
                    history.cash = cash.amount;
                    break;
                case "충전완료":
                    history.cash = 0;
                    break;
                case "취소":
                    history.cash = -cash.amount;
                    break;
            }
            await models.CashHistory.create(history);
        }

        res.json({ message: '수정되었습니다.' });
    } catch (e) {
        console.log(e)
        next(e);
    }
});
router.delete('/:id', async function (req, res, next) {
    try {
        await models.Cash.destroy({
            where: { id: req.params.id },
        });
        res.json({ message: '삭제되었습니다.' });
    } catch (e) {
        next(e);
    }
});
router.delete('/history/:id', async function (req, res, next) {
    try {
        await models.CashHistory.destroy({
            where: { id: req.params.id },
        });
        res.json({ message: '삭제되었습니다.' });
    } catch (e) {
        next(e);
    }
});
router.get('/excel/data', async function (req, res, next) {
    try {
        const user = req.user;
        const { startDate, endDate,
            prd_type, company_nm, ad_company_nm, pid, mid, account, status, all } = req.query;
        const process_status_list = {
            "진행전": "PENDING",
            "진행중": "IN_PROGRESS",
            "일시정지": "PAUSED",
            "진행완료": "COMPLETED",
            "취소됨": "CANCELED",
            "PENDING": "진행전",
            "IN_PROGRESS": "진행중",
            "PAUSED": "일시정지",
            "COMPLETED": "진행완료",
            "CANCELED": "취소됨",
        }
        const where = {};
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

        if (company_nm) where.company_nm = { [Op.like]: `%${company_nm}%` };
        if (ad_company_nm) where.ad_company_nm = { [Op.like]: `%${ad_company_nm}%` };
        if (pid) where.pmid = { [Op.like]: `%${pid}%` };
        if (mid) where.pmid = { [Op.like]: `%${mid}%` };
        if (account) where.account = { [Op.like]: `%${account}%` };
        if (prd_type) where.prd_type = { [Op.like]: `%${prd_type}%` };
        if (all) {
            const search = [
                { account: { [Op.like]: `%${all}%` } },
                { company_nm: { [Op.like]: `%${all}%` } },
                { ad_company_nm: { [Op.like]: `%${all}%` } },
                { pmid: { [Op.like]: `%${all}%` } },
                { prd_type: { [Op.like]: `%${all}%` } },
            ]
            if (where.createdAt) {
                search.map((item) => {
                    item.createdAt = where.createdAt;
                });
            }
            where[Op.or] = search;
        }

        if (user.account !== "admin") {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT }
            )
            where.AccountId = owners.map(owner => owner.id);
        }

        const cash = await models.CashHistory.findAll({
            where: where,
            include: [{
                model: models.Cash,
            }, {
                model: models.Advertisement,
                attributes: ['process_status'],
            }],
            order: [['createdAt', 'DESC']],
        }).then(cash => {
            cash = cash.map(cash => cash.toJSON());
            cash.forEach((item, idx) => {
                item.createdAt = moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss');
                item.status = item.deposit_status === "취소" ? "충전취소" : item.deposit_status;
                if (item.Advertisement) {
                    item.status = process_status_list[item.Advertisement.process_status];
                    if (item.Advertisement.deletedAt) {
                        item.status = "취소됨";
                    }
                }
            });
            return cash;
        });

        const result = cash.filter(item => {
            if (status === "전체") return true;
            return item.status === status;
        })

        const workbook = new excel.Workbook();

        let worksheet = workbook.addWorksheet("상세통계");

        const columns = [ "아이디", "일자", "상호명","입금자명","플레이스/상품명","상품유형", "PID/MID",
            "전체 참여 수", "캐시", "보유캐시", "상태"];

        worksheet.columns = columns.map(c => {
            return {
                header: c,
                key: c,
                width: 28,
            }
        });

        worksheet.addRows(result.map(r => {
            for (let key in r) {
                if (r[key] === null) {
                    r[key] = "-";
                }
            }
            return {
                "아이디": r.account,
                "일자": moment(r.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                "상호명": r.company_nm,
                "입금자명": r.depositor_nm,
                "플레이스/상품명": r.ad_company_nm,
                "상품유형": r.prd_type,
                "PID/MID": r.pmid,
                "전체 참여 수": r.limit_total,
                "캐시": r.cash,
                "보유캐시": r.current_cash,
                "상태": r.status,
            }
        }));

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=statistics.xlsx',
        );
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: '다운로드에 실패했습니다.' });
    }
});
module.exports = router;