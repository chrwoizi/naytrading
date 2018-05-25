'use strict';
module.exports = (sequelize, DataTypes) => {
    var Setting = sequelize.define('setting', {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        key: {
            allowNull: false,
            type: DataTypes.STRING(100)
        },

        value: {
            allowNull: true,
            type: DataTypes.STRING(100)
        },

        createdAt: {
            allowNull: false,
            type: DataTypes.DATE
        },

        updatedAt: {
            allowNull: false,
            type: DataTypes.DATE
        }

    }, {});
    Setting.associate = function (models) {
        // associations can be defined here
    };
    return Setting;
};