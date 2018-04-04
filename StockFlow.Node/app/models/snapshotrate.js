'use strict';
module.exports = (sequelize, DataTypes) => {
    var instrument = sequelize.define('snapshotrate', {

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

        Open: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        Close: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        High: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        Low: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        Snapshot_ID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: 'snapshots',
            referencesKey: 'ID'
        }

    }, {});
    instrument.associate = function (models) {
        // associations can be defined here
    };
    return instrument;
};