'use strict';
module.exports = (sequelize, DataTypes) => {
    const Monitor = sequelize.define('monitor', {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        key: {
            type: DataTypes.STRING(200),
            allowNull: false
        },

        value: {
            type: DataTypes.STRING,
            allowNull: false
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
    Monitor.associate = function (models) {
        // associations can be defined here
    };
    return Monitor;
};