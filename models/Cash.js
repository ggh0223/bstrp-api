'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Cash extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Cash.belongsTo(models.Account)
        }
    }

    Cash.init({
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
            comment: '플레이스/상품명',
        },
        owner: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '소유자',
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        vat: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        total_deposit_amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        depositor_nm: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: '입금자명',
        },
        payment_method: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "무통장입금",
            comment: '결제수단',
        },
        deposit_status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "충전대기",
            comment: '입금여부',
        },
        deposit_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '입금일시',
        },
        cancel_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '취소일시',
        },
        apply_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '접수일시',
        },
        tax_invoice_dt: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: '세금계산서발행일시',
        },
    }, {
        sequelize,
        modelName: 'Cash',
        timestamps: true,
    });

    return Cash;
};