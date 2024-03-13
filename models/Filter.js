'use strict';
const {Model} = require("sequelize");

module.exports = function (sequelize, DataTypes) {

    class Filter extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {

        }
    }

    Filter.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        stay_time: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        adInfoId: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ip:{
            type: DataTypes.TEXT,
            allowNull: true,
        },
        account:{
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sensor:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        rooting:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },
        simcard:{
            type: DataTypes.BOOLEAN,
            allowNull: true,
        }
    }, {
        sequelize,
        modelName: 'Filter',
        timestamps: true,
    });

    return Filter;
};
