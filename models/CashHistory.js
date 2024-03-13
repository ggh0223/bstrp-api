'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class CashHistory extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            CashHistory.belongsTo(models.Account)
            CashHistory.belongsTo(models.Advertisement)
            CashHistory.belongsTo(models.Cash)
            CashHistory.belongsTo(models.UsedCash)
        }
    }

    CashHistory.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        account: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '계정아이디',
        },
        company_nm: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '상호명',
        },
        ad_company_nm: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '플레이스/상품명',
        },
        prd_type: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '상품타입',
        },
        pmid: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '광고PID/MID',
        },
        limit_total: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: '전체참여수',
        },
        cash: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        current_cash: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '현재캐시',
        },
        depositor_nm: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '입금자명',
        },
        deposit_status: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '입금상태',
        },
        status: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '상태',
        },
    }, {
        sequelize,
        modelName: 'CashHistory',
        timestamps: true,
        paranoid: true,
    });

    return CashHistory;
};