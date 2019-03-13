'use strict';
module.exports = (sequelize, DataTypes) => {
    var Tradelog = sequelize.define('tradelog', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        Snapshot_ID: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        User: {
            type: DataTypes.STRING,
            allowNull: false
        },

        Time: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Quantity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        Price: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },

        Status: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Message: {
            type: DataTypes.TEXT,
            allowNull: true
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
        indexes: [
            { fields: ['Snapshot_ID'] },
            { fields: ['Time'] },
            { fields: ['Snapshot_ID', 'Time'] }
        ]
    });
    Tradelog.associate = function (models) {
        Tradelog.belongsTo(models.snapshot, { foreignKey: 'Snapshot_ID', allowNull: false });
    };
    return Tradelog;
};