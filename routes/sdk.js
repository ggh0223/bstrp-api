var express = require('express');
var router = express.Router();
const models = require('../models');
const moment = require("moment");
const {Op, where} = require("sequelize");
/* GET users listing. */
const jwt = require('jsonwebtoken');
const {verifyToken} = require('../middlewares/verifyToken');
const {post} = require("axios");
const axios = require("axios");
const formUrlEncoded = x =>
    Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')

router.post('/init', function(req, res, next) {
  //TODO:: 키값으로 매체 ID 반환
  const {store_key, user_name} = req.body;
  models.Account.findOne({
    where: {store_key: store_key}
  }).then(function (user) {
    var id = user.id;
    const token = jwt.sign({
      id,
      user_name,
    }, process.env.secret, {
      issuer: 'boostrep.co.kr'
    });
    res.json({status: true, message: 'success', token: token});
  });
});
router.get('/adList', verifyToken, async function (req, res, next) {
  //TODO:: limit 체크  매체의 유저별 참여여부 확인
  console.log(req.decoded);
  let user_info = req.decoded;
  const account = await models.Account.findOne({
    where: {id: user_info.id}
  });


  models.sequelize.query(`select id,\`point\`,limit_total as total_count,today_count,
       (limit_total - total_count) as total_can_count,
       (limit_per_day - today_count) as today_can_count,
       company_nm, keyword, prd_type,
       ad_url, pid, mid, thumbnail_url,gotobuy_url,
IF((limit_per_day > today_count and limit_total > total_count and done = 0), true, false) as can
from (select Advertisements.*,
                      (select count(id)
                       from Missions
                       where AdvertisementId = Advertisements.id
                         and createdAt >= date_format(now(),'%Y-%m-%d 00:00:00'))               as today_count,

                      (select count(id)
                       from Missions
                       where AdvertisementId = Advertisements.id)     as total_count,
                      IF(prd_type = 'NP_Save', (select count(id)
                                                from Missions
                                                where AccountId = ?
                                                  and user_name = ?
                                                  and AdvertisementId = Advertisements.id
                                                  and createdAt > date_add(NOW(), interval -2 month)),
                         (select count(id)
                          from Missions
                          where AccountId = ?
                            and user_name = ?
                            and AdvertisementId = Advertisements.id
                            and createdAt > date_add(NOW(), interval -1 day)))
                                                                      as done,
                      IF(prd_type = 'NP_Save', (Advertisements.platform_price * ? / 100),
                         (Advertisements.platform_price * ? / 100)) as point
               from Advertisements
               where strt_dt <= date_format(now(),'%Y-%m-%d 00:00:00')
                 and end_dt >= date_format(now(),'%Y-%m-%d 00:00:00')
                 and media like ?
                 and aprv_status = true
                 and process_status = 'IN_PROGRESS')
            as a
order by a.createdAt desc;`, {
    replacements: [account.id, user_info.user_name,account.id, user_info.user_name, account.save_per_point, account.per_point, `%${account.account}%`],
    type: models.sequelize.QueryTypes.SELECT
  }).then(function (ads) {
    for(ad of ads){
        ad.can = ad.can === 1;
    }
    res.json(ads);
  }).catch(function (err) {
    console.log(err);
    res.json({status: false, message: err});
  });
});

router.get('/adList_old', verifyToken, async function (req, res, next) {
  //TODO:: limit 체크  매체의 유저별 참여여부 확인
  console.log(req.decoded);
  let user_info = req.decoded;
  const account = await models.Account.findOne({
    where: {id: user_info.id}
  });
  models.Advertisement.findAll({
    where: {
      strt_dt: {[Op.lte]: moment().format("YYYY-MM-DD hh:mm")},
      end_dt: {[Op.gte]: moment().format("YYYY-MM-DD hh:mm")},
      media:  {[Op.like] : `%${account.account}%`},
      aprv_status: true,
      process_status: 'IN_PROGRESS'
    },
    order: [['createdAt', 'DESC']],
  }).then(async function (ads) {
    let can_ads = [];
    for (let ad of ads) {
      var ad_info = ad.toJSON();
      ad_info.can = true;
      ad_info.finished = await models.Mission.findOne({
        where: {
          user_name: user_info.user_name,
          AccountId: user_info.id
        }
      })
          .then(mission => {
            mission != null
          })
      let today_count = await models.Mission.count({
        where: {
          AdvertisementId: ad.id,
          createdAt: {[Op.gte]: moment().format("YYYY-MM-DD")}
        }
      })
      let total_count = await models.Mission.count({where: {AdvertisementId: ad.id}})

      if (ad_info.prd_type == 'NP_Save') {
        var count = await models.Mission.count({
          where: {
            AccountId: user_info.id,
            user_name: user_info.user_name,
            AdvertisementId: ad.id,
            createdAt: {[Op.gt]: moment().subtract(2, "month").format("YYYY-MM-DD HH:mm:ss")}
          }
        })
        ad_info.can = count === 0;
      } else {
        var count = await models.Mission.count({
          where: {
            AccountId: user_info.id,
            user_name: user_info.user_name,
            AdvertisementId: ad.id,
            createdAt: {[Op.gt]: moment().subtract(1, 'day').format("YYYY-MM-DD HH:mm:ss")}
          }
        })
        console.log(user_info, count)
        ad_info.can = count === 0;
      }
      if (ad_info.limit_per_day <= today_count) {
        ad_info.can = false;
      }
      if (ad_info.limit_total <= total_count) {
        ad_info.can = false;
      }
      var point = ad_info.platform_price * account.per_point / 100;
      if(ad_info.prd_type == 'NP_Save') {
        point =  ad_info.platform_price * account.save_per_point / 100;
      }
      can_ads.push({
        id: ad_info.id,
        point: point,
        total_count: ad_info.limit_total,
        today_count: ad_info.limit_per_day,
        total_can_count: ad_info.limit_total - total_count,
        today_can_count: ad_info.limit_per_day - today_count,
        company_nm: ad_info.company_nm,
        keyword: ad_info.keyword,
        prd_type: ad_info.prd_type,
        ad_url: ad_info.ad_url,
        pid: ad_info.pid,
        mid: ad_info.mid,
        thumbnail_url: ad_info.thumbnail_url,
        gotobuy_url: ad_info.gotobuy_url,
        can: ad_info.can,
      });

    }
    res.json(can_ads);
  }).catch(function (err) {
    console.log(err);
    res.json({status: false, message: err});
  });

});

router.get('/stepsv2/:adId', verifyToken, async function (req, res, next) {
  //TODO: Type에 따라서 다른 데이터를 반환
  let user_info = req.decoded;
  const account = await models.Account.findOne({
    where: {id: user_info.id}
  });
  var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  console.log(user_info);
  try {
    await models.Log.create({
      event_type: 'click',
      AccountId: user_info.id,
      user_name: user_info.user_name,
      AdvertisementId: req.params.adId,
      ip: ip
    });
  }catch (e) {
    console.error(e)
  }
  models.Advertisement.findOne({
    where: {id: req.params.adId}
  }).then(function (ad) {
    var adId = parseInt(req.params.adId);
    var point = ad.platform_price * account.per_point / 100;
    if(ad.prd_type == 'NP_Save') {
      point =  ad.platform_price * account.save_per_point / 100;
    }
    var title = ad.keyword;
    var pid = ad.pid;
    var steps = [];
    var sid = ad.mid;
    var store_name = ad.url;
    var count = 20;
    switch (ad.prd_type) {
      case "NP_Save" :
        steps = [];
        count = 15;
        steps.push({
          step: 0,
          url: "https://www.google.com",
          script: "javascript:document.querySelectorAll('.main div[role=\"link\"]')[0].click()"
        });
        steps.push({
          step: 1,
          url: "https://m.naver.com",
          script: `javascript:document.querySelector('#MM_SEARCH_FAKE').closest('section').style.border ='2px solid red';document.querySelector('#query').value ='${title}';document.querySelector('.MM_SEARCH_SUBMIT .sch_ico_mask').style.border ='2px solid red';`
        });
        steps.push({
          step: 2,
          url: "https://m.search.naver.com/search.naver",
          script: "javascript:try{if(document.querySelectorAll('.place_bluelink span').length > 0){document.querySelector('.place_bluelink span').style.border = '2px solid red'.style.border = '2px solid red';}else{document.querySelector('#loc-main-section-root ul li div').style.border = '2px solid red';}}catch(e){}try{document.querySelector('.place_bluelink span').style.border = '2px solid red'}catch(e){}try{document.querySelector('#_title a').style.border = '2px solid red'}catch(e){}"
        });
        steps.push({
          step: 3,
          url: ad.ad_url,
          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NPSCount(timeLeft)):(window.Android.NPSCountFinish(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NPSStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
          // script: ""
        });
        steps.push({
          step: 4,
          url: ad.ad_url,
          script: "javascript:setTimeout(() =>{document.querySelectorAll('.place_section div a').forEach(a =>{if(a.innerText == '저장'){ a.style.border = '2px solid red'; a.style.zIndex=100;} });}, 1500);document.addEventListener('click', function(event) {if (event.target.matches('button.swt-save-btn')) { window.Android.NPSSuccess();}}, false);"
        });
        break;
      case "NP_Traffic" :
        steps = [];
        steps.push({
          step: 0,
          url: "https://www.google.com",
          script: "javascript:document.querySelectorAll('.main div[role=\"link\"]')[0].click()"
        });
        steps.push({
          step: 1,
          url: "https://m.naver.com",
          script: `javascript:document.querySelector('#MM_SEARCH_FAKE').closest('section').style.border ='2px solid red';document.querySelector('#query').value ='${title}';document.querySelector('.MM_SEARCH_SUBMIT .sch_ico_mask').style.border ='2px solid red';`
        });
        steps.push({
          step: 2,
          url: "https://m.search.naver.com/search.naver",
          script: "javascript:try{document.querySelector('#_title a').style.border = '2px solid red'}catch(e){}try{document.querySelector('.place_bluelink span').style.border = '2px solid red'}catch(e){}"
        });
        steps.push({
          step: 3,
          url: ad.ad_url,
          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NPTCount(timeLeft)):(window.Android.NPTSuccess(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NPTStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
          // script: ""
        });
        break;
      case "NS_Traffic" :
        steps = [];
        ad.title = ad.company_nm;
        title = ad.company_nm;
        steps.push({
          step: 0,
          url: ad.gotobuy_url,
        });
        steps.push({
          step: 1,
          url: ad.ad_url,

          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NSTCount(timeLeft)):(window.Android.NSTSuccess(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NSTStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
        });
//         let countdownTimer;
//         let timeLeft = 15; // 10초 카운트다운
//         let isScrolling;
//
// // 카운트다운을 업데이트하는 함수
//       function updateCountdown() {
//         if (timeLeft > 0) {
//           timeLeft--;
//           console.log(timeLeft + '초 남음');
//         } else {
//           console.log('카운트다운 끝!');
//           window.Android.NSTSuccess();
//           stopCountdown();
//         }
//       }
//
// // 카운트다운 시작 함수
//       function startCountdown() {
//         if (!countdownTimer) {
//           countdownTimer = setInterval(updateCountdown, 1000);
//         }
//       }
//
// // 카운트다운 정지 함수
//       function stopCountdown() {
//         window.Android.NSTStop();
//         clearInterval(countdownTimer);
//         countdownTimer = null;
//       }
//
//         window.addEventListener('scroll', function () {
//           // 사용자가 스크롤 중일 때 카운트다운 시작
//           startCountdown();
//
//           // 스크롤이 멈추었는지 확인
//           clearTimeout(isScrolling);
//           isScrolling = setTimeout(function() {
//             // 스크롤이 멈추면 카운트다운 정지
//             stopCountdown();
//           }, 2000); // 100밀리초 동안 스크롤이 없으면 스크롤이 멈춘 것으로 간주
//         });

        break;
    }

    res.json({title: title,count:count, point: point, pid: pid, sid: sid, store_name: store_name, steps: steps});
  });
});

router.get('/stepsv3/:adId', verifyToken, async function (req, res, next) {
  //TODO: Type에 따라서 다른 데이터를 반환
  let user_info = req.decoded;
  const account = await models.Account.findOne({
    where: {id: user_info.id}
  });
  var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  console.log(user_info);
  try {
    await models.Log.create({
      event_type: 'click',
      AccountId: user_info.id,
      user_name: user_info.user_name,
      AdvertisementId: req.params.adId,
      ip: ip
    });
  }catch (e) {
    console.error(e)
  }
  models.Advertisement.findOne({
    where: {id: req.params.adId}
  }).then(function (ad) {
    var adId = parseInt(req.params.adId);
    var point = ad.platform_price * account.per_point / 100;
    if(ad.prd_type == 'NP_Save') {
      point =  ad.platform_price * account.save_per_point / 100;
    }
    var title = ad.keyword;
    var pid = ad.pid;
    var steps = [];
    var sid = ad.mid;
    var store_name = ad.url;
    var point_unit = account.point_unit;
    var count = 20;
    switch (ad.prd_type) {
      case "NP_Save" :
        steps = [];
        count = 15;
        steps.push({
          step: 0,
          url: "https://www.google.com",
          script: "javascript:document.querySelectorAll('.main div[role=\"link\"]')[0].click()"
        });
        steps.push({
          step: 1,
          url: "https://m.naver.com",
          script: `javascript:document.querySelector('#MM_SEARCH_FAKE').closest('section').style.border ='2px solid red';document.querySelector('#query').value ='${title}';document.querySelector('.MM_SEARCH_SUBMIT .sch_ico_mask').style.border ='2px solid red';`
        });
        steps.push({
          step: 2,
          url: "https://m.search.naver.com/search.naver",
          script: `javascript:find_pid(${pid},'${title}', 'save')`
        });
        steps.push({
          step: 3,
          url: ad.ad_url,
          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NPSCount(timeLeft)):(window.Android.NPSCountFinish(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NPSStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
          // script: ""
        });
        steps.push({
          step: 4,
          url: ad.ad_url,
          script: "javascript:setTimeout(() =>{document.querySelectorAll('.place_section div a').forEach(a =>{if(a.innerText == '저장'){ a.style.border = '2px solid red'; a.style.zIndex=100;} });}, 1500);if(document.querySelector('a[href*=\"#bookmark\"]').getAttribute(\"aria-pressed\") == \"true\"){window.Android.NPSSuccess();}document.addEventListener('click', function(event) {if (event.target.matches('button.swt-save-btn')) { window.Android.NPSSuccess();}}, false);"
        });
        break;
      case "NP_Traffic" :
        steps = [];
        steps.push({
          step: 0,
          url: "https://www.google.com",
          script: "javascript:document.querySelectorAll('.main div[role=\"link\"]')[0].click()"
        });
        steps.push({
          step: 1,
          url: "https://m.naver.com",
          script: `javascript:document.querySelector('#MM_SEARCH_FAKE').closest('section').style.border ='2px solid red';document.querySelector('#query').value ='${title}';document.querySelector('.MM_SEARCH_SUBMIT .sch_ico_mask').style.border ='2px solid red';`
        });
        steps.push({
          step: 2,
          url: "https://m.search.naver.com/search.naver",
          script: `javascript:find_pid(${pid},'${title}','traffic')`
        });
        steps.push({
          step: 3,
          url: ad.ad_url,
          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NPTCount(timeLeft)):(window.Android.NPTSuccess(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NPTStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
          // script: ""
        });
        break;
      case "NS_Traffic" :
        steps = [];
        ad.title = ad.company_nm;
        title = ad.company_nm;
        steps.push({
          step: 0,
          url: ad.gotobuy_url,
        });
        steps.push({
          step: 1,
          url: ad.ad_url,

          script: `let countdownTimer,timeLeft=${count},isScrolling;function updateCountdown(){timeLeft>0?(timeLeft--,window.Android.NSTCount(timeLeft)):(window.Android.NSTSuccess(),stopCountdown())}function startCountdown(){countdownTimer||(countdownTimer=setInterval(updateCountdown,1e3))}function stopCountdown(){timeLeft>0&&window.Android.NSTStop(),clearInterval(countdownTimer),countdownTimer=null}window.addEventListener('scroll',function(){startCountdown(),clearTimeout(isScrolling),isScrolling=setTimeout(function(){stopCountdown()},2e3)});`
        });
        break;
    }

    var appendScript ="function find_pid(e,l,r){console.log(\"find_pid\");var o=document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"]'),c=document.querySelectorAll('a[href*=\"/'+e+'\"]');if(o.length>0||c.length>0){try{document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"] .place_bluelink span')[0].style.border=\"2px solid red\",document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"] .place_bluelink span')[0].scrollIntoView({block:\"center\"})}catch(t){}try{document.querySelectorAll('a[href*=\"/'+e+'\"] .place_bluelink span')[0].style.border=\"2px solid red\",document.querySelectorAll('a[href*=\"/'+e+'\"] .place_bluelink span')[0].scrollIntoView({block:\"center\"})}catch(d){}try{document.querySelector(\"#_title a\").style.border=\"2px solid red\"}catch(n){}\"save\"==r?window.Android.NPSRed():(console.log(\"traffic\"),window.Android.NPTRed())}else{var i=Array.from(document.querySelectorAll(\"a\")).find(e=>\"펼쳐서 더보기\"===e.textContent);i?(i.style.border=\"2px solid red\",i.scrollIntoView({block:\"center\"}),\"save\"==r?(window.Android.NPSMore(\"펼쳐서 더보기\"),setTimeout(()=>{find_pid(e,l,r)},1e3)):(window.Android.NPTMore(\"펼쳐서 더보기\"),setTimeout(()=>{find_pid(e,l,r)},1e3))):((i=Array.from(document.querySelectorAll(\"div a\")).find(e=>e.textContent===l+\"더보기\")).style.border=\"2px solid red\",i.scrollIntoView({block:\"center\"}),\"save\"==r?window.Android.NPSMore(l+\" 더보기\"):window.Android.NPTMore(l+\" 더보기\"),i?console.log(\"clearInterval\"):setTimeout(()=>{find_pid(e,l,r)},1e3))}}function find_more(e){let l=document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"]'),r=document.querySelectorAll('a[href*=\"/'+e+'\"]');if(l.length>0||r.length>0){try{document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"] .place_bluelink span')[0].style.border=\"2px solid red\",document.querySelectorAll('[data-loc_plc-doc-id=\"'+e+'\"] .place_bluelink span')[0].scrollIntoView({block:\"center\"})}catch(o){}try{document.querySelectorAll('a[href*=\"/'+e+'\"] .place_bluelink span')[0].style.border=\"2px solid red\",document.querySelectorAll('a[href*=\"/'+e+'\"] .place_bluelink span')[0].scrollIntoView({block:\"center\"})}catch(c){}return!0}setTimeout(()=>{find_more(e)},1e3)}";
    res.json({title: title,count:count, appendScript: appendScript,
       point_unit: point_unit,
      point: point, pid: pid, sid: sid, store_name: store_name, steps: steps});
  });
});

router.post('/success/:adId',verifyToken, async function(req, res, next) {
  //Callback and save db
  let {adInfoId, deviceInfo,hasGyro,MODEL,BRAND,RELEASE,SDK_INT, sensor, rooting, simcard} = req.body;
  let user_info = req.decoded;
  var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

  const account= await models.Account.findOne({
    where:{id: user_info.id}
  });
  const ad = await models.Advertisement.findOne({
    where: {
      id: req.params.adId,
      aprv_status: true,
      process_status: 'IN_PROGRESS'
    }
  });

  let daily = await models.Mission.count({
    where: { AdvertisementId: req.params.adId, date: moment().format("YYYY-MM-DD")}
  });
  var uniq = {};
  if(daily <= ad.limit_per_day) {
    if (ad) {

      var point = ad.platform_price * account.per_point / 100;

      if (ad.prd_type == 'NP_Save') {
        point = ad.platform_price * account.save_per_point / 100;
        uniq =  `${account.id}_${adInfoId}_${req.params.adId}_${moment().format("YYYY-MM-DD")}`;
        var where = {
          AccountId: account.id,
          AdvertisementId: req.params.adId,
          [Op.or]: [
            {uniq: uniq},
            {
              date: moment().format("YYYY-MM-DD"),
              ip: ip
            }
          ]
        }

      } else {
        uniq =  `${account.id}_${adInfoId}_${req.params.adId}_${moment().format("YYYY-MM-DD")}`;
        var where = {
          AccountId: account.id,
          AdvertisementId: req.params.adId,
          date: moment().format("YYYY-MM-DD"),
          [Op.or]: [
            {uniq: uniq},
            {
              date: moment().format("YYYY-MM-DD"),
              ip: ip
            }
          ]
        }
      }

      try {
        const [mission, created] = await models.Mission.findOrCreate({
          defaults: {
            date: moment().format("YYYY-MM-DD"),
            point: point,
            ad_point: ad.ad_unit_price,
            md_point: ad.platform_price,
            success: true,
            AccountId: account.id,
            user_name: user_info.user_name,
            AdvertisementId: req.params.adId,
            adInfoId: adInfoId,
            uniq: uniq,
            ip: ip,
            deviceInfo: deviceInfo,
            hasGyro: hasGyro === "true",
            MODEL: MODEL,
            BRAND: BRAND,
            RELEASE: RELEASE,
            SDK_INT: SDK_INT,
            sensor: sensor,
            rooting: rooting === "true",
            simcard: simcard === "true"
          },
          where: where
        });
        if (created) {
          try {
            const missionCount = await models.Mission.count({
              where: {
                AdvertisementId: req.params.adId,
              }
            });
            if (missionCount >= ad.limit_total) {
              await models.Advertisement.update({
                process_status: 'COMPLETED'
              }, {
                where: {
                  id: req.params.adId
                }
              });
            }
            if (account.callback_url) {
              var result = await
                  axios({
                    url: account.callback_url,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    data: formUrlEncoded({
                      mission_id: mission.id,
                      success: true,
                      point: point,
                      user_name: user_info.user_name,
                      ad_id: req.params.adId,
                      adId: req.params.adId
                    }),
                    method: 'post',
                  });
              await models.Log.create({
                event_type: 'callback',
                AccountId: account.id,
                user_name: user_info.user_name,
                AdvertisementId: req.params.adId,
                log: result.data.message.toString(),
                ip: ip
              });
            }
          } catch (e) {
            console.error(e);
            await models.Log.create({
              event_type: 'callback',
              AccountId: account.id,
              user_name: user_info.user_name,
              AdvertisementId: req.params.adId,
              log: e.message.toString(),
              ip: ip
            });
          }
          res.json({
            mission_id: mission.id,
            success: true,
            point: point,
            user_name: user_info.user_name,
            ad_id: req.params.adId
          });
        } else {
          res.json({
            success: false,
            message: '이미 참여한 광고입니다',
          });
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      res.json({
        success: false,
        message: '종료된 광고입니다',
      });
    }
  }else {
    res.json({
      success: false,
      message: '오늘의 참여 가능한 광고수를 초과하였습니다',
    });
  }
});

module.exports = router;
