var express                 = require('express');
var router                  = express.Router();
const models                = require('../models');
const jwt                   = require('jsonwebtoken');
const moment                = require("moment");
const {Op} = require("sequelize");
const multer = require("multer");
const fs = require("fs");
const excel = require('exceljs');

router.get('/dashboard/list', async function (req, res, next) {
    const { startDate, endDate, prd_type, ad_company_nm, all } = req.query;
    const user = req.user
    const where = {};
    if (user.auth !== 'admin') where.AccountId = user.id;
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
    if (prd_type) where.prd_type = { [Op.like]: `%${prd_type}%` };
    if (ad_company_nm) where.company_nm = { [Op.like]: `%${ad_company_nm}%` };
    if (all) {
        const search = [
            { company_nm: { [Op.like]: `%${all}%` } },
            { prd_type: { [Op.like]: `%${all}%` } },
        ]
        search.map((item) => {
            if (where.createdAt) {
                item.createdAt = where.createdAt;
            }
            if (user.auth !== 'admin') item.AccountId = user.id;
        });
        where[Op.or] = search;
    }

    models.Advertisement.findAll({
        where: where,
        order: [['createdAt', 'DESC']],
        include: {
            model: models.Mission,
        }
    }).then(ad => {
        ad = ad.map((item) => item.toJSON());
        ad = ad.map((item) => {
            item.mission_today = item.Missions.filter((mission) => {
                return moment(mission.createdAt).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD');
            }).length;
            item.mission_total = item.Missions.length;
            item.createdAt = moment(item.createdAt).format("YYYY-MM-DD HH:mm:ss");
            return item;
        });
        console.log(ad)
        res.json(ad);
    });
});
router.get('/aprv/list', async function (req, res, next) {
    try {
        const { aprv_status, process_status, startDate, endDate,
            prd_type, ad_company_nm, pid, mid, account, keyword, all } = req.query;

        let where = { aprv_status: !!Number(aprv_status), process_status: process_status.split(',') };
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
        if (prd_type) where.prd_type = { [Op.like]: `%${prd_type}%` };
        if (ad_company_nm) where.company_nm = { [Op.like]: `%${ad_company_nm}%` };
        if (pid) where.pid = { [Op.like]: `%${pid}%` };
        if (mid) where.mid = { [Op.like]: `%${mid}%` };
        if (account) where['$Account.account$'] = { [Op.like]: `%${account}%` };
        if (keyword) where.keyword = { [Op.like]: `%${keyword}%` };
        if (all) {
            const search = [
                { ['$Account.account$']: { [Op.like]: `%${all}%` } },
                { company_nm: { [Op.like]: `%${all}%` } },
                { prd_type: { [Op.like]: `%${all}%` } },
                { pid: { [Op.like]: `%${all}%` } },
                { mid: { [Op.like]: `%${all}%` } },
                { keyword: { [Op.like]: `%${all}%` } },
            ]
            search.map((item) => {
                if (where.createdAt) {
                    item.createdAt = where.createdAt;
                }
                item.aprv_status = where.aprv_status;
                item.process_status = where.process_status;
            });

            where = {
                [Op.or]: search
            }
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

            if (owners.length > 0) {
                where.AccountId = owners.map(owner => owner.id);
            }
        }

        const ads = await models.Advertisement.findAll({
            where: where,
            include: [{
                model: models.Account,
                attributes: ['account', 'cash', 'owner'],
            },]
        }).then(ad => ad.map((item) => item.toJSON())
            .filter((item) => item.Account)); // Account가 삭제된 경우 (soft delete)

        for (let i = 0; i < ads.length; i++) {
            const ad = ads[i];
            const missions = await models.Mission.findAll({
                where: {
                    AdvertisementId: ad.id,
                }
            }).then(missions => missions.map((item) => item.toJSON()));
            ad.mission_today = missions.filter((mission) => {
                return moment(mission.createdAt).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD');
            }).length;
            ad.mission_total = missions.length;

            ad.account = ad.Account.account;
            ad.cash = ad.Account.cash;
            ad.owner = ad.Account.owner;
            // if (ad.ad_unit_price) {
            //     const totalPrice = ad.ad_unit_price * ad.limit_total;
            //     if (ad.cash >= totalPrice) {
            //         ad.charge_status = "충전됨";
            //     } else {
            //         ad.charge_status = "부족함";
            //     }
            // } else {
            //     ad.charge_status = "대기중";
            // }

            if (ad.process_status === "PENDING" || ad.process_status === "PAUSED") {
                const usedCash = await models.UsedCash.findOne({
                    where: {
                        AdvertisementId: ad.id,
                    }
                });
                if (usedCash) {
                    ad.status = "일시중지";
                } else
                    // 02.19 [수정] 캐시충전상태 관련 승인조건에서 제거
                //     if (ad.charge_status === "부족함") {
                //     ad.status = "캐시부족";
                // } else
                {
                    ad.status = "승인대기중";
                }
            } else if (ad.process_status === "IN_PROGRESS") {
                if (moment(ad.strt_dt).format("YYYY-MM-DD") > moment().format("YYYY-MM-DD")) {
                    ad.status = "진행전";
                } else {
                    ad.status = "진행중";
                }
            }
        }
        res.send(ads);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/aprv/list/v2', async function (req, res, next) {
    try {
        const user = req.user;
        const { aprv_status, process_status, startDate, endDate,
            prd_type, ad_company_nm, pid, mid, account, keyword, all } = req.query;

        let where = [`deletedAt is null`, `aprv_status = ${!!Number(aprv_status)}`, `process_status in ('${process_status.split(',').join("','")}')`];
        if (user.account !== 'admin') {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT })
            if (owners.length > 0) {
                where.push(`AccountId in (${owners.map(owner => owner.id).join(",")})`);
            }
        }
        if (startDate && endDate) {
            where.push(`createdAt between '${startDate}' and '${endDate}'`);
        } else if (startDate) {
            where.push(`createdAt >= '${startDate}'`);
        } else if (endDate) {
            where.push(`createdAt <= '${endDate}'`);
        }
        if (prd_type) where.push(`prd_type like '%${prd_type}%'`);
        if (ad_company_nm) where.push(`company_nm like '%${ad_company_nm}%'`);
        if (pid) where.push(`pid like '%${pid}%'`);
        if (mid) where.push(`mid like '%${mid}%'`);
        if (account) where.push(`account like '%${account}%'`);
        if (keyword) where.push(`keyword like '%${keyword}%'`);
        if (all) {
            const search = [
                `account like '%${all}%'`,
                `company_nm like '%${all}%'`,
                `prd_type like '%${all}%'`,
                `pid like '%${all}%'`,
                `mid like '%${all}%'`,
                `keyword like '%${all}%'`,
            ]
            const currentWhere = where.join(" and ");
            where = search.map((item) => {
                item = currentWhere + " and " + item;
                return item;
            }).join(" or ");
        }

        if (where.length > 0 && Array.isArray(where)) {
            where = where.join(" and ");
        }

        const queryResult = await models.sequelize.query(`
            select *
            from (Advertisements as ad
                left join (select id as ac_id, account, cash, owner from Accounts) A
                on ad.AccountId = A.ac_id
                left join (select id as m_id,
                                  count(id) as mission_total,
                                  sum(IF(date_format(createdAt, '%Y-%m-%d')=date_format(now(), '%Y-%m-%d') ,1,0)) as mission_today,
                                  AdvertisementId as m_ad_id
                           from Missions
                           group by AdvertisementId) M
                on ad.id = M.m_ad_id
                left join (select max(id) as uc_id, AdvertisementId as uc_ad_id
                           from UsedCashes) U
                  on ad.id = U.uc_ad_id

                     )
            where ${where}

            ;
        `, {
            type: models.sequelize.QueryTypes.SELECT
        });

        for (let i = 0; i < queryResult.length; i++) {
            const ad = queryResult[i];

            if (ad.process_status === "PENDING" || ad.process_status === "PAUSED") {

                if (ad.uc_id) {
                    ad.status = "일시중지";
                } else {
                    ad.status = "승인대기중";
                }
            } else if (ad.process_status === "IN_PROGRESS") {
                if (moment(ad.strt_dt).format("YYYY-MM-DD") > moment().format("YYYY-MM-DD")) {
                    ad.status = "진행전";
                } else {
                    ad.status = "진행중";
                }
            }
        }

        res.send(queryResult);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/statistics', async function (req, res, next) {
    try {
        const user = req.user;
        const { type, prd_type, startDate, endDate, company_nm, media, keyword } = req.query;

        const mission_where = {};
        if (user.account !== 'admin') {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT })

            if (owners.length > 0) {
                const ads = await models.Advertisement.findAll({
                    where: {
                        AccountId: owners.map(owner => owner.id),
                    },
                    attributes: ['id'],
                }).then(ads => ads.map((item) => item.toJSON().id));
                mission_where.AdvertisementId = ads;
            }
            console.log("owners")
            console.timeLog("statistics")
        }
        if (startDate && endDate) {
            mission_where.createdAt = {
                [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
            }
        } else if (startDate) {
            mission_where.createdAt = {
                [Op.gte]: startDate + " 00:00:00"
            }
        } else if (endDate) {
            mission_where.createdAt = {
                [Op.lte]: endDate + " 23:59:59"
            }
        }
        if (media && media !== "전체") {
            const mediaData = await models.Account.findOne({
                where: { account: media }
            }).then(account => account.toJSON());
            if (mediaData) mission_where.AccountId = mediaData.id;
        }

        const ad_where = {};
        if (prd_type && prd_type !== "전체") ad_where.prd_type = prd_type;
        if (company_nm && company_nm !== "전체") ad_where.id = company_nm;
        if (media && media !== "전체") ad_where.media = { [Op.like]: `%${media}%` };
        // if (keyword !== "전체") ad_where.keyword = keyword;

        let result = {};
        let columns;
        switch (type) {
            case "일별":
                columns = ["date", "prd_type"];
                break;
            case "월별":
                columns = ["month", "prd_type"];
                break;
            case "플레이스/상품명":
                columns = ["date", "company_nm", "keyword", "prd_type"];
                break;
            case "매체별":
                if (media === "전체") {
                    columns = ["date", "media", "prd_type"];
                } else {
                    columns = ["date", "media", "company_nm", "keyword", "prd_type"];
                }
                break;
            default: columns = [];
                break;
        }

        const missions = await models.Mission.findAll({
            where: mission_where,
            include: [
                {
                    model: models.Advertisement,
                    where: ad_where,
                    attributes: ['company_nm', 'prd_type', 'keyword', 'media', 'pid', 'mid'],
                },
                {
                    model: models.Account,
                    attributes: ['account'],
                    paranoid: false,
                }
            ],
            order: [['createdAt', 'ASC']],
        }).then(mission => mission.map((item) => item.toJSON()));

        if (type !== "상세") {
            for (let i = 0; i < missions.length; i++) {
                const mission = missions[i];
                const date = moment(mission.createdAt).format("YYYY-MM-DD");
                const month = moment(mission.createdAt).format("YYYY-MM");
                const m_prd_type = mission.Advertisement.prd_type;
                const m_company_nm = mission.Advertisement.company_nm;
                const m_media = mission.Account.account;
                const m_keyword = mission.Advertisement.keyword ? mission.Advertisement.keyword : "공백";

                if (type === "월별") {
                    createObj(result, mission, month, m_prd_type);
                } else if (type === "플레이스/상품명") {
                    createObj(result, mission, date, m_company_nm, m_keyword, m_prd_type);
                } else if (type === "매체별") {
                    if (m_media) {
                        if (media === "전체") {
                            createObj(result, mission, date, m_media, m_prd_type);
                        } else {
                            createObj(result, mission, date, m_media, m_company_nm, m_keyword, m_prd_type);
                        }
                    }
                } else {
                    createObj(result, mission, date, m_prd_type);
                }
            }

            const clicks = await models.Log.findAll({
                where: {
                    ...mission_where,
                    event_type: 'click',
                },
                include: [
                    {
                        model: models.Advertisement,
                        where: ad_where,
                        attributes: ['company_nm', 'prd_type', 'keyword', 'media', 'pid', 'mid'],
                        paranoid: false,
                    },
                    {
                        model: models.Account,
                        attributes: ['account'],
                        paranoid: false,
                    },
                ],
                paranoid: false,
            }).then(click => click.map((item) => item.toJSON()));
            for (let i = 0; i < clicks.length; i++) {
                const click = clicks[i];
                const date = moment(click.createdAt).format("YYYY-MM-DD");
                const month = moment(click.createdAt).format("YYYY-MM");
                const m_prd_type = click.Advertisement.prd_type;
                const m_company_nm = click.Advertisement.company_nm;
                const m_media = click.Account.account;
                const m_keyword = click.Advertisement.keyword ? click.Advertisement.keyword : "공백";

                if (type === "월별") {
                    increaseClick(result, click, month, m_prd_type);
                } else if (type === "플레이스/상품명") {
                    increaseClick(result, click, date, m_company_nm, m_keyword, m_prd_type);
                } else if (type === "매체별") {
                    if (m_media) {
                        if (media === "전체") {
                            increaseClick(result, click, date, m_media, m_prd_type);
                        } else {
                            increaseClick(result, click, date, m_media, m_company_nm, m_keyword, m_prd_type);
                        }
                    }
                } else {
                    increaseClick(result, click, date, m_prd_type);
                }
            }
        } else {
            result = missions?.map((item) => {
                item.createdAt = moment(item.createdAt).format("YYYY-MM-DD HH:mm:ss");
                return {...item, ...item.Advertisement};
            });
        }
        res.send({list: result, columns: columns});
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/statistics/v2', async function (req, res, next) {
    try {
        const user = req.user;
        const { type, prd_type, startDate, endDate, company_nm, media, keyword, offset, limit } = req.query;
        let columns;
        switch (type) {
            case "일별":
                columns = ["date", "prd_type"];
                break;
            case "월별":
                columns = ["month", "prd_type"];
                break;
            case "플레이스/상품명":
                columns = ["date", "company_nm", "keyword", "prd_type"];
                break;
            case "매체별":
                if (media === "전체") {
                    columns = ["date", "media", "prd_type"];
                } else {
                    columns = ["date", "media", "company_nm", "keyword", "prd_type"];
                }
                break;
            default: columns = [];
                break;
        }

        if (type === "상세") {
            const mission_where = {};
            if (user.account !== 'admin') {
                let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                    { type: models.Sequelize.QueryTypes.SELECT })

                if (owners.length > 0) {
                    const ads = await models.Advertisement.findAll({
                        where: {
                            AccountId: owners.map(owner => owner.id),
                        },
                        attributes: ['id'],
                    }).then(ads => ads.map((item) => item.toJSON().id));
                    mission_where.AdvertisementId = ads;
                }
            }
            if (startDate && endDate) {
                mission_where.createdAt = {
                    [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
                }
            } else if (startDate) {
                mission_where.createdAt = {
                    [Op.gte]: startDate + " 00:00:00"
                }
            } else if (endDate) {
                mission_where.createdAt = {
                    [Op.lte]: endDate + " 23:59:59"
                }
            }
            if (media && media !== "전체") {
                const mediaData = await models.Account.findOne({
                    where: { account: media }
                }).then(account => account.toJSON());
                if (mediaData) mission_where.AccountId = mediaData.id;
            }

            const ad_where = {};
            if (prd_type && prd_type !== "전체") ad_where.prd_type = prd_type;
            if (company_nm && company_nm !== "전체") ad_where.id = company_nm;
            if (media && media !== "전체") ad_where.media = { [Op.like]: `%${media}%` };

            const {rows, count} = await models.Mission.findAndCountAll({
                where: mission_where,
                include: [
                    {
                        model: models.Advertisement,
                        where: ad_where,
                        attributes: ['company_nm', 'prd_type', 'keyword', 'media', 'pid', 'mid'],
                    },
                    {
                        model: models.Account,
                        attributes: ['account'],
                        paranoid: false,
                    }
                ],
                offset: Number(offset ?? 0),
                limit: Number(limit ?? 100),
                order: [['createdAt', 'ASC']],
            }).then(mission => {
                console.log(mission)
                mission.rows = mission.rows.map((item) => item.toJSON());
                return mission;
            });

            const result = rows?.map((item) => {
                item.createdAt = moment(item.createdAt).format("YYYY-MM-DD HH:mm:ss");
                return {...item, ...item.Advertisement};
            });

            return res.send({list: result, columns: columns, totalCount: count});
        }

        const where = [];
        if (user.account !== 'admin') {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT })
            if (owners.length > 0) {
                const ads = await models.Advertisement.findAll({
                    where: {
                        AccountId: owners.map(owner => owner.id),
                    },
                    attributes: ['id'],
                }).then(ads => ads.map((item) => item.toJSON().id));
                where.push(`AdvertisementId in (${ads.join(",")})`);
            }
        }
        if (startDate && endDate) {
            where.push(`mission_date between '${startDate}' and '${endDate}'`);
        } else if (startDate) {
            where.push(`mission_date >= '${startDate}'`);
        } else if (endDate) {
            where.push(`mission_date <= '${endDate}'`);
        }

        if (media && media !== "전체") {
            where.push(`Accounts.account = '${media}'`);
        }
        if (prd_type && prd_type !== "전체") {
            where.push(`ad.prd_type = '${prd_type}'`);
        }
        if (company_nm && company_nm !== "전체") {
            where.push(`AdvertisementId = '${company_nm}'`);
        }

        const queryResult = await models.sequelize.query(`
            select
                mission_date,
                ad_point,
                ad_point_total,
                md_point_total,
                engages,
                profit,
                ad.ad_owner as ad_owner,
                ad.ad_account as ad_account,
                ad.ad_account_auth as ad_account_auth,
                ad.prd_type as ad_prd_type,
                ad.company_nm as ad_name,
                ad.keyword as ad_keyword,
                Accounts.account as mission_media,
                cmdAI.clicks as clicks,
                AdvertisementId,
                m_account_id
            from ((select
                        ad_point,
                        date_format(createdAt, '%Y-%m-%d') as mission_date,
                        sum(ad_point)                      as ad_point_total,
                        sum(md_point)                      as md_point_total,
                        sum(ad_point) - sum(md_point)      as profit,
                        count(id)                          as engages,
                        AdvertisementId,
                        AccountId                          as m_account_id
                      from Missions
                      group by mission_date, AdvertisementId, AccountId) as mission_data
                         left join (select Advertisements.id as ad_id, prd_type, 
                                           Advertisements.company_nm, 
                                           Advertisements.keyword, media,
                                           owner as ad_owner, account as ad_account, auth as ad_account_auth
                                    from Advertisements
                                        left join Accounts on Advertisements.AccountId = Accounts.id
                                    )
                             as ad on mission_data.AdvertisementId = ad.ad_id
                         left join Accounts on mission_data.m_account_id = Accounts.id
                         left join (select L.clicks as clicks, log_date, log_ad_id, log_account_id
                                    from ((select SUM(IF(Logs.event_type = 'click', 1, 0)) as clicks,
                                                  date_format(createdAt, '%Y-%m-%d')       as log_date,
                                                  AdvertisementId                          as log_ad_id,
                                                  AccountId                                as log_account_id
                                           from Logs
                                           group by log_date, log_ad_id, log_account_id) as L
                                             )) as cmdAI
                         on mission_data.AdvertisementId = cmdAI.log_ad_id
                             and mission_data.mission_date = cmdAI.log_date 
                                and mission_data.m_account_id = cmdAI.log_account_id)
                ${where.length > 0 ? "where "+ where.join(" and ") : ""}
        ;`, {
            type: models.sequelize.QueryTypes.SELECT
        })

        let result = {};
        for (let i = 0; i < queryResult.length; i++) {
            const mission = queryResult[i];
            const date = moment(mission.mission_date).format("YYYY-MM-DD");
            const month = moment(mission.mission_date).format("YYYY-MM");
            const m_prd_type = mission.ad_prd_type;
            const m_company_nm = mission.ad_name;
            const m_media = mission.mission_media;
            const m_keyword = mission.ad_keyword ? mission.ad_keyword : "공백";

            if (type === "월별") {
                createObj(result, mission, month, m_prd_type);
            } else if (type === "플레이스/상품명") {
                createObj(result, mission, date, m_company_nm, m_keyword, m_prd_type);
            } else if (type === "매체별") {
                if (m_media) {
                    if (media === "전체") {
                        createObj(result, mission, date, m_media, m_prd_type);
                    } else {
                        createObj(result, mission, date, m_media, m_company_nm, m_keyword, m_prd_type);
                    }
                }
            } else {
                createObj(result, mission, date, m_prd_type);
            }
        }

        res.send({list: result, columns: columns});
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/company_option', async function (req, res, next) {
    try {
        const media = req.query.media;
        const where = {};
        if (media && media !== "전체") where.media = media;
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

            if (owners.length > 0) {
                where.AccountId = owners.map(owner => owner.id);
            }
        }
        const result = await models.Advertisement.findAll({
            where: where
        }).then(ad => ad.map((item) => item.toJSON()));
        res.json(result);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/keyword_option', async function (req, res, next) {
    try {
        const company_nm = req.query.company_nm;
        const where = {
            prd_type: {
                [Op.ne]: "NS_Traffic"
            }
        };
        if (company_nm !== "전체") where.id = company_nm;
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

            if (owners.length > 0) {
                where.AccountId = owners.map(owner => owner.id);
            }
        }
        const result = await models.Advertisement.findAll({
            where: where
        }).then(ad => ad.map((item) => item.toJSON()));
        console.log(result)
        res.json(result);
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.get('/:id', function (req, res, next) {
    console.log(req.params.id)
    models.Advertisement.findOne({
        where: { id: req.params.id }
    }).then(ad => {
        console.log(ad)
        res.json(ad);
    });
});
router.post('/', async function (req, res, next) {
    console.log(req.body)
    try {
        const ad = await models.Advertisement.create({
            ...req.body,
            AccountId: req.user.id,
        });
        if (req.body.thumbnail_url) {
            const image = await models.File.findOne({
                where: { url: req.body.thumbnail_url }
            });

            image.AdvertisementId = ad.id;
            await image.save();
        }

        res.json({ message: '등록되었습니다.' });
    } catch (e) {
        console.log(e);
        next(e);
    }

});
router.post('/copy/:id', async function (req, res, next) {
    try {
        const ad = await models.Advertisement.findOne({
            where: { id: req.params.id }
        }).then(ad => ad.toJSON());
        delete ad.id;
        delete ad.createdAt;
        delete ad.updatedAt;
        ad.company_nm = ad.company_nm + "_복사본"
        ad.aprv_status = false;
        ad.process_status = "PENDING";
        await models.Advertisement.create(ad);

        res.json({ message: '복사되었습니다.' });
    } catch (e) {
        console.log(e);
        next(e);
    }
});
router.put('/:id', async function (req, res, next) {
    try {
        typeof(req.body.limit_total) === 'string' && (req.body.limit_total = req.body.limit_total.replace(/,/g, ''));
        const result = await models.Advertisement.update(req.body, {
            where: { id: req.params.id }, returning: true,
        });
        console.log(result)
        res.json({ message: '수정되었습니다.' });
    } catch (e) {
        console.log(e);
        next(e);
    }

});
router.patch('/:id', async function (req, res, next) {
    // const transaction = await models.sequelize.transaction();
    try {
        await models.Advertisement.update(req.body, {
            where: { id: req.params.id }, returning: true,
        });
        const process_status = req.body.process_status;

        if (process_status) {
            const ad = await models.Advertisement.findOne({
                where: {
                    id: req.params.id,
                },
                include: {
                    model: models.Account,
                    attributes: ['id', 'account', 'company_nm', 'cash'],
                }
            }).then(ad => ad.toJSON());
            const count = await models.Mission.count({
                where: {
                    AdvertisementId: req.params.id,
                }
            });
            let history;
            if (process_status === "IN_PROGRESS") {
                const useCash = ad.ad_unit_price * (ad.limit_total - count);
                const rmndCash = ad.Account.cash - useCash;
                const created = await models.UsedCash.create({
                    account: ad.Account.account,
                    company_nm: ad.Account.company_nm,
                    ad_company_nm: ad.company_nm,
                    prd_type: ad.prd_type,
                    pid: ad.pid,
                    mid: ad.mid,
                    limit_total: ad.limit_total,
                    amount: useCash,
                    rmnd_amount: rmndCash,
                    AdvertisementId: req.params.id,
                    AccountId: ad.Account.id,
                });
                await models.Account.update({
                    cash: rmndCash,
                }, {
                    where: {
                        id: ad.Account.id,
                    }
                });

                history = {
                    account: ad.Account.account,
                    company_nm: ad.Account.company_nm,
                    ad_company_nm: ad.company_nm,
                    prd_type: ad.prd_type,
                    pmid: ad.pid ?? ad.mid,
                    limit_total: ad.limit_total,
                    cash: -useCash,
                    current_cash: rmndCash,
                    AccountId: ad.Account.id,
                    AdvertisementId: req.params.id,
                    UsedCashId: created.id,
                }
                // 히스토리 추가
                // await models.CashHistory.create({
                //     account: ad.Account.account,
                //     company_nm: ad.Account.company_nm,
                //     ad_company_nm: ad.company_nm,
                //     prd_type: ad.prd_type,
                //     pmid: ad.pid ?? ad.mid,
                //     limit_total: ad.limit_total,
                //     cash: -useCash,
                //     current_cash: rmndCash,
                //     AccountId: ad.Account.id,
                //     AdvertisementId: req.params.id,
                //     UsedCashId: created.id,
                // });
            } else if (process_status === "PAUSED") {
                const current_mission_count = await models.Mission.count({
                    where: {
                        AdvertisementId: req.params.id,
                        // returned: false,
                    }
                });
                const current_mission_point = await models.Mission.sum('ad_point',{
                    where: {
                        AdvertisementId: req.params.id,
                        // returned: false,
                    }
                });
                const usedCash = await models.UsedCash.findOne({
                    where: {
                        AdvertisementId: req.params.id,
                    },
                    order: [['createdAt', 'DESC']],
                });
                const returnCash = current_mission_point;
                const rmndCash = ad.Account.cash + returnCash;
                await models.Account.update({
                    cash: rmndCash,
                }, {
                    where: {
                        id: ad.Account.id,
                    }
                });

                // await models.Mission.update({
                //     returned: true,
                // }, {
                //     where: {
                //         AdvertisementId: req.params.id,
                //         returned: false,
                //     }
                // });

                history = {
                    account: ad.Account.account,
                    company_nm: ad.Account.company_nm,
                    ad_company_nm: ad.company_nm,
                    prd_type: ad.prd_type,
                    pmid: ad.pid ?? ad.mid,
                    limit_total: current_mission_count,
                    cash: returnCash,
                    current_cash: rmndCash,
                    status: process_status,
                    AccountId: ad.Account.id,
                    AdvertisementId: req.params.id,
                    UsedCashId: usedCash.id,
                }
                // 히스토리 추가
                // await models.CashHistory.create({
                //     account: ad.Account.account,
                //     company_nm: ad.Account.company_nm,
                //     ad_company_nm: ad.company_nm,
                //     prd_type: ad.prd_type,
                //     pmid: ad.pid ?? ad.mid,
                //     limit_total: current_mission_count,
                //     cash: returnCash,
                //     current_cash: rmndCash,
                //     status: process_status,
                //     AccountId: ad.Account.id,
                //     AdvertisementId: req.params.id,
                //     UsedCashId: usedCash.id,
                // });
            }
            const [ cashHistory, created ] = await models.CashHistory.findOrCreate({
                where: {
                    AdvertisementId: req.params.id,
                },
                defaults: history,
                order: [['createdAt', 'DESC']],
            });
            if (!created) {
                await cashHistory.update(history);
            }
        }

        if (req.body.thumbnail_url) {
            const image = await models.File.findOne({
                where: { url: req.body.thumbnail_url }
            });

            image.AdvertisementId = req.params.id;
            await image.save();
        }
        res.json({ message: '수정되었습니다.' });
    } catch (e) {
        next(e);
    }
});
router.delete('/:id', function (req, res, next) {
    models.Advertisement.destroy({
        where: { id: req.params.id }
    }).then(ad => {
        console.log(ad);
        res.json({ message: '삭제되었습니다.' });
    });
});

const upload = multer({
    fileFilter: (request, file, callback) => {
        const whitelist = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/docxconverter",
            "application/haansoftxlsx",
            "application/kset",
            "application/vnd.ms-excel.12",
            "x-softmaker-pm"];
        if (whitelist.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new Error("확장자 오류"), false);
        }
    },
    storage: multer.diskStorage({
        destination: function (request, file, callback) {
            console.log("destination", file)
            const uploadPath = 'public/uploads/excel';
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath);
            }
            const ext = file.originalname.split('.').pop();
            file.ext = ext;
            file.filename = moment().format("YYYYMMDDHHmmssSSS") + '.' + ext;
            callback(null, uploadPath);
        },
        filename: (request, file, callback) => {
            console.log("filename", file)
            callback(null, file.filename);
        },
    }),
    // limits: { fileSize: 5 * 1024 * 1024 } // 5메가로 용량 제한
})
router.get('/excel/template', function (req, res, next) {
    const file = 'public/uploads/excel/template.xlsx';
    res.download(file);
});
router.get('/excel/data', async function (req, res, next) {
    try {
        const user = req.user;
        const { type, prd_type, startDate, endDate, company_nm, media, keyword } = req.query;

        const mission_where = {};
        if (user.account !== 'admin') {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT })

            if (owners.length > 0) {
                const ads = await models.Advertisement.findAll({
                    where: {
                        AccountId: owners.map(owner => owner.id),
                    },
                    attributes: ['id'],
                }).then(ads => ads.map((item) => item.toJSON().id));
                mission_where.AdvertisementId = ads;
            }
        }
        if (startDate && endDate) {
            mission_where.createdAt = {
                [Op.between]: [startDate + " 00:00:00", endDate + " 23:59:59"]
            }
        } else if (startDate) {
            mission_where.createdAt = {
                [Op.gte]: startDate + " 00:00:00"
            }
        } else if (endDate) {
            mission_where.createdAt = {
                [Op.lte]: endDate + " 23:59:59"
            }
        }
        const ad_where = {};
        if (prd_type && prd_type !== "전체") ad_where.prd_type = prd_type;
        if (company_nm && company_nm !== "전체") ad_where.id = company_nm;
        if (media && media !== "전체") ad_where.media = media;
        if (keyword && keyword !== "전체") ad_where.keyword = keyword;

            const missions = await models.Mission.findAll({
                where: mission_where,
                include: [
                    {
                        model: models.Advertisement,
                        where: ad_where,
                        attributes: ['company_nm', 'prd_type', 'keyword', 'media', 'pid', 'mid'],
                    },
                ],
                order: [['createdAt', 'ASC']],
            }).then(mission => mission.map((item) => item.toJSON()));

        const result = missions?.map((item) => {
            item.createdAt = moment(item.createdAt).format("YYYY-MM-DD HH:mm:ss");
            return {...item, ...item.Advertisement};
        });

        const workbook = new excel.Workbook();

        let worksheet = workbook.addWorksheet("상세통계");

        let columns = [ "구분", "플레이스/상품명", "키워드", "상품유형", "PID", "MID", "매체명", "ADID", "IP",
            "기기정보", "기기유심", "기기루팅", "기기센서", "기울기값", "모델", "브랜드", "RELEASE", "SDK" ];
        if (user.account !== 'admin') {
            columns = [ "구분", "플레이스/상품명", "키워드", "상품유형", "PID", "MID", "ADID", "IP"];
        }
        worksheet.columns = columns.map(c => {
            return {
                header: c,
                key: c,
                width: 28,
            }
        });

        worksheet.addRows(result.map(r => {
            if (user.account !== 'admin') {
                return {
                    "구분": moment(r.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                    "플레이스/상품명": r.company_nm,
                    "키워드": r.keyword,
                    "상품유형": r.prd_type,
                    "PID": r.pid,
                    "MID": r.mid,
                    "ADID": r.adInfoId,
                    "IP": r.ip,
                }
            } else {
                return {
                    "구분": moment(r.createdAt).format("YYYY-MM-DD HH:mm:ss"),
                    "플레이스/상품명": r.company_nm,
                    "키워드": r.keyword,
                    "상품유형": r.prd_type,
                    "PID": r.pid,
                    "MID": r.mid,
                    "매체명": r.media,
                    "ADID": r.adInfoId,
                    "IP": r.ip,
                    "기기정보": r.deviceInfo,
                    "기기유심": r.simcard,
                    "기기루팅": r.rooting,
                    "기기센서": r.sensor,
                    "기울기값": r.hasGyro,
                    "모델": r.MODEL,
                    "브랜드": r.BRAND,
                    "RELEASE": r.RELEASE,
                    "SDK": r.SDK_INT,

                }
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
router.get('/excel/statistics', async function (req, res, next) {
    try {
        const user = req.user;
        const { type, prd_type, startDate, endDate, company_nm, media, keyword, offset, limit } = req.query;

        const where = [];
        if (user.account !== 'admin') {
            let owners = await models.sequelize.query(`WITH RECURSIVE cte (account, owner, id) AS
                               (SELECT account, owner, id FROM Accounts WHERE account = '${req.user.account}'
                                   UNION ALL
                                   SELECT t.account, t.owner, t.id
                                   FROM cte c
                                   JOIN Accounts t
                                   ON c.account = t.owner)
                               SELECT * FROM cte;`,
                { type: models.Sequelize.QueryTypes.SELECT })
            if (owners.length > 0) {
                const ads = await models.Advertisement.findAll({
                    where: {
                        AccountId: owners.map(owner => owner.id),
                    },
                    attributes: ['id'],
                }).then(ads => ads.map((item) => item.toJSON().id));
                where.push(`AdvertisementId in (${ads.join(",")})`);
            }
        }

        if (startDate && endDate) {
            where.push(`mission_date between '${startDate}' and '${endDate}'`);
        } else if (startDate) {
            where.push(`mission_date >= '${startDate}'`);
        } else if (endDate) {
            where.push(`mission_date <= '${endDate}'`);
        }

        const queryResult = await models.sequelize.query(`
            select
                mission_date,
                ad_point,
                ad_point_total,
                md_point_total,
                engages,
                profit,
                ad.ad_owner as ad_owner,
                ad.ad_account as ad_account,
                ad.ad_account_auth as ad_account_auth,
                ad.prd_type as ad_prd_type,
                ad.company_nm as ad_name,
                ad.keyword as ad_keyword,
                Accounts.account as mission_media,
                cmdAI.clicks as clicks,
                AdvertisementId,
                m_account_id
            from ((select
                        ad_point,
                        date_format(createdAt, '%Y-%m-%d') as mission_date,
                        sum(ad_point)                      as ad_point_total,
                        sum(md_point)                      as md_point_total,
                        sum(ad_point) - sum(md_point)      as profit,
                        count(id)                          as engages,
                        AdvertisementId,
                        AccountId                          as m_account_id
                      from Missions
                      group by mission_date, AdvertisementId, AccountId) as mission_data
                         left join (select Advertisements.id as ad_id, prd_type, 
                                           Advertisements.company_nm, 
                                           Advertisements.keyword, media,
                                           owner as ad_owner, account as ad_account, auth as ad_account_auth
                                    from Advertisements
                                        left join Accounts on Advertisements.AccountId = Accounts.id
                                    )
                             as ad on mission_data.AdvertisementId = ad.ad_id
                         left join Accounts on mission_data.m_account_id = Accounts.id
                         left join (select L.clicks as clicks, log_date, log_ad_id, log_account_id
                                    from ((select SUM(IF(Logs.event_type = 'click', 1, 0)) as clicks,
                                                  date_format(createdAt, '%Y-%m-%d')       as log_date,
                                                  AdvertisementId                          as log_ad_id,
                                                  AccountId                                as log_account_id
                                           from Logs
                                           group by log_date, log_ad_id, log_account_id) as L
                                             )) as cmdAI
                         on mission_data.AdvertisementId = cmdAI.log_ad_id
                             and mission_data.mission_date = cmdAI.log_date 
                                and mission_data.m_account_id = cmdAI.log_account_id)
                ${where.length > 0 ? "where "+ where.join(" and ") : ""}
        ;`, {
            type: models.sequelize.QueryTypes.SELECT
        });

        const workbook = new excel.Workbook();

        let worksheet = workbook.addWorksheet("상세통계");

        let columns = [ "구분", "소유자", "아이디", "권한", "상품유형", "플레이스/상품명", "키워드", "매체명", "클릭수", "참여수",
            "광고단가", "소진금액", "매체금액", "수익" ];

        worksheet.columns = columns.map(c => {
            return {
                header: c,
                key: c,
                width: 28,
            }
        });

        worksheet.addRows(queryResult.map(r => {
            return {
                "구분": r.mission_date,
                "소유자": r.ad_owner,
                "아이디": r.ad_account,
                "권한": r.ad_account_auth,
                "상품유형": r.ad_prd_type,
                "플레이스/상품명": r.ad_name,
                "키워드": r.ad_keyword,
                "매체명": r.mission_media,
                "클릭수": r.clicks,
                "참여수": r.engages,
                "광고단가": r.ad_point,
                "소진금액": r.ad_point_total,
                "매체금액": r.md_point_total,
                "수익": r.profit,
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
        next(e);
    }
});

router.post('/excel/preview', upload.single('file'), async function (req, res, next) {
    const user = req.user;
    const file = req.file;
    try {
        const keys = {
            "상품유형": "prd_type",
            "플레이스/상품명": "company_nm",
            "키워드": "keyword",
            "광고URL": "ad_url",
            "PID/MID": "pid",
            // "MID": "mid",
            "1일참여제한": "limit_per_day",
            "전체참여제한": "limit_total",
            "광고시작일": "strt_dt",
            // "광고종료일": "end_dt",
        };

        const WorkBook = new excel.Workbook();
        const workbook = await WorkBook.xlsx.readFile(file.path);
        const worksheet = workbook.getWorksheet(1);
        const length = worksheet._rows.length;
        const columns = worksheet.getRow(1).values.map((value) => {
            if (typeof value === "string") {
                return keys[value];
            } else {
                value = value.richText.reduce((acc, cur) => {
                    return acc + cur.text;
                }, "");
                return keys[value];
            }
        });
        const rows = [];
        for (let i = 2; i <= length; i++) {
            const row = worksheet.getRow(i).values;
            if (row.length) {
                const obj = {};
                for (let j = 1; j < columns.length; j++) {
                    let data = row[j];
                    if (!data || data === "undefined" || data === undefined) {
                        continue;
                    }
                    if (typeof data === "object") {
                        if (data.richText) {
                            data = data.richText.reduce((acc, cur) => {
                                return acc + cur.text;
                            }, "");
                        } else if (data.hyperlink) {
                            data = data.text;
                        }
                    }
                    obj[columns[j]] = data;
                }
                if (Object.keys(obj).length === Object.keys(keys).length) {
                    rows.push(obj);
                } else if (Object.keys(obj).length > 0) {
                    return res.status(400).json({message: "엑셀 입력값을 확인해주세요."});
                }
            }
        }

        const result = rows.map(r => {
            const result = {
                ...r,
                AccountId: user.id,
            };

            if (result.prd_type === "NS_Traffic") {
                result.mid = result.pid;
                result.pid = null;
            }
            const period = Math.floor(result.limit_total / result.limit_per_day) - 1;
            result.strt_dt += " 00:00";
            result.end_dt = moment(result.strt_dt).add(period, 'days').format("YYYY-MM-DD");
            result.end_dt += " 23:59";
            result.ad_period_type = period + "일";
            return result
        })
        console.log(result)
        res.json(result);
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: '엑셀파일을 읽는데 실패했습니다.' });
    } finally {
        fs.unlinkSync(file.path);
    }
});
router.post('/excel', upload.single('file'), async function (req, res, next) {
    const user = req.user;
    const file = req.file;
    const transaction = await models.sequelize.transaction()
    try {
        console.log(file)
        const keys = {
            "상품유형": "prd_type",
            "플레이스/상품명": "company_nm",
            "키워드": "keyword",
            "광고URL": "ad_url",
            "PID/MID": "pid",
            // "MID": "mid",
            "1일참여제한": "limit_per_day",
            "전체참여제한": "limit_total",
            "광고시작일": "strt_dt",
            // "광고종료일": "end_dt",
        };

        const WorkBook = new excel.Workbook();
        const workbook = await WorkBook.xlsx.readFile(file.path);
        const worksheet = workbook.getWorksheet(1);
        const length = worksheet._rows.length;
        const columns = worksheet.getRow(1).values.map((value) => {
            if (typeof value === "string") {
                return keys[value];
            } else {
                value = value.richText.reduce((acc, cur) => {
                    return acc + cur.text;
                }, "");
                return keys[value];
            }
        });
        const rows = [];
        for (let i = 2; i <= length; i++) {
            const row = worksheet.getRow(i).values;
            if (row.length) {
                const obj = {};
                for (let j = 1; j < columns.length; j++) {
                    let data = row[j];
                    if (!data || data === "undefined" || data === undefined) {
                        continue;
                    }
                    if (typeof data === "object") {
                        if (data.richText) {
                            data = data.richText.reduce((acc, cur) => {
                                return acc + cur.text;
                            }, "");
                        } else if (data.hyperlink) {
                            data = data.text;
                        }
                    }
                    obj[columns[j]] = data;
                }
                if (Object.keys(obj).length === Object.keys(keys).length) {
                    rows.push(obj);
                } else if (Object.keys(obj).length > 0) {
                    return res.status(400).json({message: "엑셀 입력값을 확인해주세요."});
                }
            }
        }

        const result = await models.Advertisement.bulkCreate(rows.map(r => {
            const result = {
                ...r,
                AccountId: user.id,
            };

            if (result.prd_type === "NS_Traffic") {
                result.mid = result.pid;
                result.pid = null;
            }
            const period = Math.floor(result.limit_total / result.limit_per_day) - 1;
            result.strt_dt += " 00:00";
            result.end_dt = moment(result.strt_dt).add(period, 'days').format("YYYY-MM-DD");
            result.end_dt += " 23:59";
            result.ad_period_type = period + "일";
            return result
        }),{transaction});

        await transaction.commit();
        console.log(result)
        res.json(result);
    } catch (e) {
        console.log(e);
        await transaction.rollback()
        res.status(500).json({ message: '엑셀파일을 읽는데 실패했습니다.' });
    } finally {
        await transaction.cleanup();
        fs.unlinkSync(file.path);
    }
});



function createObj(orgnl, data, key1, key2, key3 = null, key4 = null, key5 = null) {
    if (!orgnl.total) {
        orgnl.total = {
            mission: data.engages,
            cost_media: data.md_point_total,
            cost: data.ad_point_total,
            click: data.clicks,
            profit: data.profit,
        };
    } else {
        orgnl.total.mission += data.engages;
        orgnl.total.cost_media += data.md_point_total;
        orgnl.total.cost += data.ad_point_total;
        orgnl.total.click += data.clicks;
        orgnl.total.profit += data.profit;
    }
    if (!orgnl[key1]) {
        orgnl[key1] = {};
    }
    if (!orgnl[key1].total) {
        orgnl[key1].total = {
            mission: 0,
            cost_media: 0,
            cost: 0,
            click: 0,
            profit: 0,
        };
    }
    orgnl[key1].total.mission += data.engages;
    orgnl[key1].total.cost_media += data.md_point_total;
    orgnl[key1].total.cost += data.ad_point_total;
    orgnl[key1].total.click += data.clicks;
    orgnl[key1].total.profit += data.profit;

    if (!orgnl[key1][key2]) {
        orgnl[key1][key2] = {};
    }
    if (!key3) {
        if (!orgnl[key1][key2].mission) {
            orgnl[key1][key2] = {
                mission: 0,
                cost_media: 0,
                cost: 0,
                click: 0,
                profit: 0,
            };
        }
        orgnl[key1][key2].mission += data.engages;
        orgnl[key1][key2].cost_media += data.md_point_total;
        orgnl[key1][key2].cost += data.ad_point_total;
        orgnl[key1][key2].click += data.clicks;
        orgnl[key1][key2].profit += data.profit;
    } else {
        if (!orgnl[key1][key2][key3]) {
            orgnl[key1][key2][key3] = {};
        }
        if (!key4) {
            if (!orgnl[key1][key2][key3].mission) {
                orgnl[key1][key2][key3] = {
                    mission: 0,
                    cost_media: 0,
                    cost: 0,
                    click: 0,
                    profit: 0,
                };
            }
            orgnl[key1][key2][key3].mission += data.engages;
            orgnl[key1][key2][key3].cost_media += data.md_point_total;
            orgnl[key1][key2][key3].cost += data.ad_point_total;
            orgnl[key1][key2][key3].click += data.clicks;
            orgnl[key1][key2][key3].profit += data.profit;
        } else {
            if (!orgnl[key1][key2][key3][key4]) {
                orgnl[key1][key2][key3][key4] = {};
            }
            if (!key5) {
                if (!orgnl[key1][key2][key3][key4].mission) {
                    orgnl[key1][key2][key3][key4] = {
                        mission: 0,
                        cost_media: 0,
                        cost: 0,
                        click: 0,
                        profit: 0,
                    };
                }
                orgnl[key1][key2][key3][key4].mission += data.engages;
                orgnl[key1][key2][key3][key4].cost_media += data.md_point_total;
                orgnl[key1][key2][key3][key4].cost += data.ad_point_total;
                orgnl[key1][key2][key3][key4].click += data.clicks;
                orgnl[key1][key2][key3][key4].profit += data.profit;
            } else {
                if (!orgnl[key1][key2][key3][key4][key5]) {
                    orgnl[key1][key2][key3][key4][key5] = {
                        mission: 0,
                        cost_media: 0,
                        cost: 0,
                        click: 0,
                        profit: 0,
                    };
                }
                orgnl[key1][key2][key3][key4][key5].mission += data.engages;
                orgnl[key1][key2][key3][key4][key5].cost_media += data.md_point_total;
                orgnl[key1][key2][key3][key4][key5].cost += data.ad_point_total;
                orgnl[key1][key2][key3][key4][key5].click += data.clicks;
                orgnl[key1][key2][key3][key4][key5].profit += data.profit;
            }
        }
    }
}
function increaseClick(orgnl, data, key1, key2, key3 = null, key4 = null, key5 = null) {
    if (!orgnl.total) {
        orgnl.total = {
            mission: 0,
            cost_media: 0,
            cost: 0,
            click: data.clicks,
            profit: 0,
        };
    } else {
        orgnl.total.click += data.clicks;
    }
    if (!orgnl[key1]) {
        orgnl[key1] = {};
    }
    if (!orgnl[key1].total) {
        orgnl[key1].total = {
            mission: 0,
            cost_media: 0,
            cost: 0,
            click: 0,
            profit: 0,
        };
    }
    orgnl[key1].total.click += data.clicks;
    if (!orgnl[key1][key2]) {
        orgnl[key1][key2] = {};
    }
    if (!key3) {
        if (!orgnl[key1][key2].mission) {
            orgnl[key1][key2] = {
                mission: 0,
                cost_media: 0,
                cost: 0,
                click: 0,
                profit: 0,
            };
        }
        orgnl[key1][key2].click += data.clicks;
    } else {
        if (!orgnl[key1][key2][key3]) {
            orgnl[key1][key2][key3] = {};
        }
        if (!key4) {
            if (!orgnl[key1][key2][key3].mission) {
                orgnl[key1][key2][key3] = {
                    mission: 0,
                    cost_media: 0,
                    cost: 0,
                    click: 0,
                    profit: 0,
                };
            }
            orgnl[key1][key2][key3].click += data.clicks;
        } else {
            if (!orgnl[key1][key2][key3][key4]) {
                orgnl[key1][key2][key3][key4] = {};
            }
            if (!key5) {
                if (!orgnl[key1][key2][key3][key4].mission) {
                    orgnl[key1][key2][key3][key4] = {
                        mission: 0,
                        cost_media: 0,
                        cost: 0,
                        click: 0,
                        profit: 0,
                    };
                }
                orgnl[key1][key2][key3][key4].click += data.clicks;
            } else {
                if (!orgnl[key1][key2][key3][key4][key5]) {
                    orgnl[key1][key2][key3][key4][key5] = {
                        mission: 0,
                        cost_media: 0,
                        cost: 0,
                        click: 0,
                        profit: 0,
                    };
                }
                orgnl[key1][key2][key3][key4][key5].click += data.clicks;
            }
        }
    }
}

module.exports = router;
