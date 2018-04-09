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
        }

    }, {});
    snapshotrate.associate = function (models) {
        snapshotrate.belongsTo(models.snapshot, { foreignKey: 'Snapshot_ID', allowNull: false });
    };
    return snapshotrate;
};