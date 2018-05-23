'use strict';
module.exports = (sequelize, DataTypes) => {
    var snapshot = sequelize.define('snapshot', {

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

        ModifiedTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Decision: {
            type: DataTypes.STRING(6),
            allowNull: true
        },

        User: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Price: {
            type: DataTypes.DECIMAL(8,2),
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
            { fields: ['Decision'] },
            { fields: ['User', 'Time'] },
            { fields: ['User', 'Instrument_ID'] },
            { fields: ['User', 'Instrument_ID', 'Decision'] },
            { fields: ['User', 'Time', 'Instrument_ID'] },
            { fields: ['User', 'Decision'] },
            { fields: ['Time', 'Decision'] },
            { fields: ['User', 'Time', 'Decision', 'Instrument_ID'] }
        ]
    });
    snapshot.associate = function (models) {
        snapshot.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
        snapshot.hasMany(models.snapshotrate, { foreignKey: 'Snapshot_ID', onDelete: 'CASCADE', hooks: true });
    };
    return snapshot;
};