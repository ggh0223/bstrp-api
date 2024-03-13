'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcrypt');
const Crypto = require('crypto');
module.exports = (sequelize, DataTypes) => {
    class Account extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Account.hasMany(models.Cash)
            Account.hasMany(models.Advertisement)
            Account.hasMany(models.Mission)
            Account.hasMany(models.CashHistory)
        }
    }

    Account.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        account: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        auth: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        owner: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        mng_acc_cnt: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        cash: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        company_nm: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        store_key: {
            unique: true,
            type: DataTypes.STRING,
            allowNull: false,
        },
        callback_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        per_point: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        save_per_point: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        biz_reg: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '사업자등록증URL',
        },
        point_unit: {
            type: DataTypes.STRING,
            defaultValue: 'P',
        }
    }, {
        sequelize,
        modelName: 'Account',
        timestamps: true,
        paranoid: true,
    });

    Account.beforeCreate(async (account, options) => {
        console.log("beforeCount", account, options);
        account.store_key = Crypto
            .randomBytes(16)
            .toString('base64')
            .slice(0, 16)
    });
    Account.findOrCreate({
        where: { account: 'admin' },
        defaults: {
            password: "1234",
            auth: "관리자",
            owner: "admin",
            company_nm: "admin",
        }
    })

    return Account;
};
