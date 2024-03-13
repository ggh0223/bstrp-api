var express = require('express');
const fs = require("fs");
var router = express.Router();
const multer = require("multer");
const moment = require("moment");
const models = require('../models');

const upload = multer({
  fileFilter: (request, file, callback) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png|svg\+xml|gif)$/)) {
      callback(null, true);
    } else {
      callback(new Error("확장자 오류"), false);
    }
  },
  storage: multer.diskStorage({
    destination: function (request, file, callback) {
      console.log("destination", file)
      const uploadPath = 'public/uploads';
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

/* GET home page. */
router.post('/upload', upload.single('image'), async function(req, res, next) {
  const file = await models.File.create({
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    destination: req.file.destination,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    url: req.file.path.replace('public', process.env.API_HOST),
  });
  res.json(file);
});

module.exports = router;
