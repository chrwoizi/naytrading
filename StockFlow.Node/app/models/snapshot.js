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
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        User: {
            type: DataTypes.TEXT('long'),
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
        indexes: [{ fields: ['User'] }]
    });
    snapshot.associate = function (models) {
        snapshot.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
        snapshot.hasMany(models.snapshotrate, { foreignKey: 'Snapshot_ID', onDelete: 'CASCADE', hooks: true });
    };
    return snapshot;
};