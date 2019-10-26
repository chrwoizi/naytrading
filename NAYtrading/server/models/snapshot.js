'use strict';
module.exports = (sequelize, DataTypes) => {
    const snapshot = sequelize.define('snapshot', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        StartTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Time: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Price: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: false
        },

        PriceTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        FirstPriceTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Split: {
            allowNull: true,
            type: DataTypes.STRING(30)
        },

        SourceType: {
            allowNull: false,
            type: DataTypes.STRING(10)
        },

        MarketId: {
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

    },
        {
            indexes: [
                { fields: ['Time'] },
                { fields: ['Instrument_ID'] },
                { fields: ['Time', 'Instrument_ID'] },
                { fields: ['PriceTime'] },
                { fields: ['PriceTime', 'FirstPriceTime'] },
                { fields: ['FirstPriceTime'] },
                { fields: ['SourceType'] },
                { fields: ['Split'] }
            ]
        });
    snapshot.associate = function (models) {
        snapshot.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
        snapshot.hasMany(models.snapshotrate, { foreignKey: 'Snapshot_ID', onDelete: 'CASCADE', hooks: true });
        snapshot.hasMany(models.usersnapshot, { foreignKey: 'Snapshot_ID', onDelete: 'CASCADE', hooks: true });
        snapshot.hasMany(models.tradelog, { foreignKey: 'Snapshot_ID', onDelete: 'CASCADE', hooks: true });
    };
    return snapshot;
};