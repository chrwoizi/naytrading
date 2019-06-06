'use strict';
module.exports = (sequelize, DataTypes) => {
    var portfolio = sequelize.define('portfolio', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        Time: {
            type: DataTypes.DATE,
            allowNull: false
        },

        User: {
            type: DataTypes.STRING,
            allowNull: false
        },

        Deposit: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false
        },

        Balance: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false
        },

        Value: {
            type: DataTypes.DECIMAL(14, 2),
            allowNull: false
        },

        OpenCount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        CompleteCount: {
            type: DataTypes.INTEGER,
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

    },
        {
            indexes: [{ fields: ['User'] }, { fields: ['Time'] }]
        });
    return portfolio;
};