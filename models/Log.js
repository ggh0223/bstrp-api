'use strict';
const {Model} = require("sequelize");

module.exports = function (sequelize, DataTypes) {

    class Log extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Log.belongsTo(models.Advertisement)
            Log.belongsTo(models.Account)
        }
    }

    Log.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        event_type: {
          type: DataTypes.ENUM('view', 'click', 'mission', 'callback'),
        },
        user_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        log:{
            type: DataTypes.STRING,
            allowNull: true,
        },
        ip:{
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'Log',
        timestamps: true,
    });

    return Log;
};
