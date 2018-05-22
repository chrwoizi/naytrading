'use strict';
module.exports = (sequelize, DataTypes) => {
    var snapshotrate = sequelize.define('snapshotrate', {

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
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },

        Close: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },

        High: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: true
        },

        Low: {
            type: DataTypes.DECIMAL(8, 2),
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
            { fields: ['Time'] },
            { fields: ['Snapshot_ID', 'Time'] },
            { fields: ['Snapshot_ID'] }
        ]
    });
    snapshotrate.associate = function (models) {
        snapshotrate.belongsTo(models.snapshot, { foreignKey: 'Snapshot_ID', allowNull: false });
    };
    return snapshotrate;
};