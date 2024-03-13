'use strict';
const {Model} = require("sequelize");

module.exports = function (sequelize, DataTypes) {

    class Mission extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Mission.belongsTo(models.Advertisement)
            Mission.belongsTo(models.Account)
        }
    }

    Mission.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        point: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        ad_point: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        md_point: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        success: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        user_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        uniq:{
            unique: true,
            type: DataTypes.STRING,
            allowNull: true,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        adInfoId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        ip:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        deviceInfo:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        hasGyro:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        MODEL:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        BRAND:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        RELEASE:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        SDK_INT:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        sensor:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        rooting:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        simcard:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        returned:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            comment: '미션완료후 광고 일시중지 시 캐시 반환여부',
        }
    }, {
        sequelize,
        modelName: 'Mission',
        timestamps: true,
    });

    return Mission;
};
