'use strict';
module.exports = (sequelize, DataTypes) => {
    var Whitelist = sequelize.define('whitelist', {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        email: {
            type: DataTypes.STRING(200),
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
    Whitelist.associate = function (models) {
        // associations can be defined here
    };
    return Whitelist;
};