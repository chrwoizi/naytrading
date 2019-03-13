'use strict';
module.exports = (sequelize, DataTypes) => {
    var instrumentrate = sequelize.define('instrumentrate', {

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
            { fields: ['Instrument_ID', 'Time'] },
            { fields: ['Instrument_ID'] }
        ]
    });
    instrumentrate.associate = function (models) {
        instrumentrate.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
    };
    return instrumentrate;
};