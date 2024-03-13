'use strict';
const {Model} = require("sequelize");

module.exports = function (sequelize, DataTypes) {

    class Click extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Click.belongsTo(models.Advertisement)
            Click.belongsTo(models.Account)
        }
    }

    Click.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        user_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Click',
        timestamps: true,
    });

    return Click;
};
