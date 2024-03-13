'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UsedCash extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            UsedCash.belongsTo(models.Cash)
            UsedCash.belongsTo(models.Account)
            UsedCash.belongsTo(models.Advertisement)
        }
    }

    UsedCash.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        account: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        company_nm: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ad_company_nm: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        prd_type: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '상품타입',
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
        limit_total: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '광고총수량',
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        rmnd_amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    }, {
        sequelize,
        modelName: 'UsedCash',
        timestamps: true,
    });

    return UsedCash;
};