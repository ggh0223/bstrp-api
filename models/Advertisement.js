'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Advertisement extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Advertisement.belongsTo(models.Account)
            Advertisement.hasMany(models.File)
            Advertisement.hasMany(models.Mission)
        }
    }

    Advertisement.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        company_nm: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '플레이스/상품명',
        },
        ad_period_type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '광고기간타입',
        },
        strt_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고시작일',
        },
        end_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고종료일',
        },
        limit_per_day: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '광고일일수량',
        },
        limit_total: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '광고총수량',
        },
        prd_type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '상품타입',
        },
        keyword: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '키워드',
        },
        ad_url: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고URL',
        },
        pid: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고PID',
        },
        mid: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고MID',
        },
        ad_unit_price: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '광고단가',
        },
        platform_price: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: '플랫폼가격',
        },
        thumbnail_url: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '썸네일URL',
        },
        gotobuy_url: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '구매URL',
        },
        mission_img_url: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '미션이미지URL',
        },
        aprv_status: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: '승인여부',
        },
        media: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '매체',
        },
        process_status: {
            type: DataTypes.ENUM('PENDING', 'IN_PROGRESS','PAUSED', 'COMPLETED', 'CANCELED'),
            allowNull: false,
            defaultValue: 'PENDING',
            comment: '진행상태',
        },
    }, {
        sequelize,
        modelName: 'Advertisement',
        timestamps: true,
        paranoid: true,
    });

    return Advertisement;
};