'use strict';
module.exports = (sequelize, DataTypes) => {
    const usersnapshot = sequelize.define('usersnapshot', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        User: {
            type: DataTypes.STRING,
            allowNull: false
        },

        ModifiedTime: {
            type: DataTypes.DATE,
            allowNull: false
        },

        Decision: {
            type: DataTypes.STRING(8),
            allowNull: true
        },

        Confirmed: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
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
                { fields: ['Decision'] },
                { fields: ['Snapshot_ID'] },
                { fields: ['User', 'Snapshot_ID'] },
                { fields: ['User', 'Snapshot_ID', 'Decision'] },
                { fields: ['User', 'Decision'] }
            ]
        });
    usersnapshot.associate = function (models) {
        usersnapshot.belongsTo(models.snapshot, { foreignKey: 'Snapshot_ID', allowNull: false });
    };
    return usersnapshot;
};