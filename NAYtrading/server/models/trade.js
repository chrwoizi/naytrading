'use strict';
module.exports = (sequelize, DataTypes) => {
    var trade = sequelize.define('trade', {

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

        Price: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: false
        },

        Quantity: {
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
            indexes: [
                { fields: ['User'] },
                { fields: ['Time'] },
                { fields: ['User', 'Snapshot_ID'] },
                { fields: ['User', 'Time'] },
                { fields: ['User', 'Time', 'Snapshot_ID'] },
                { fields: ['Time', 'Snapshot_ID'] }
            ]
        });
    trade.associate = function (models) {
        trade.belongsTo(models.snapshot, { foreignKey: 'Snapshot_ID', allowNull: false });
    };
    return trade;
};