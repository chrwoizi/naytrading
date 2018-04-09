'use strict';
module.exports = (sequelize, DataTypes) => {
    var instrument = sequelize.define('instrument', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        Source: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        InstrumentName: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        InstrumentId: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        MarketId: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        Capitalization: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        User: {
            type: DataTypes.TEXT('long'),
            allowNull: false
        },

        Strikes: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        Isin: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        Wkn: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        LastStrikeTime: {
            type: DataTypes.DATE,
            allowNull: false
        }

    },
    {
        indexes: [{ fields: ['User'] }]
    });
    instrument.associate = function (models) {
        instrument.hasMany(models.snapshot, { foreignKey: 'Instrument_ID', onDelete: 'cascade', hooks: true });
    };
    return instrument;
};