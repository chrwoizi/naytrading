'use strict';
module.exports = (sequelize, DataTypes) => {
    var User = sequelize.define('user', {

        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        email: {
            type: DataTypes.STRING(200),
            validate: {
                isEmail: true
            }
        },

        password: {
            type: DataTypes.STRING(200),
            allowNull: false
        },

        last_login: {
            type: DataTypes.DATE
        },

        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
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
    User.associate = function (models) {
        // associations can be defined here
    };
    return User;
};