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
            type: DataTypes.STRING,
            allowNull: true
        },

        InstrumentName: {
            type: DataTypes.STRING,
            allowNull: true
        },

        InstrumentId: {
            type: DataTypes.STRING,
            allowNull: true
        },

        MarketId: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Capitalization: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        User: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Strikes: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        Isin: {
            type: DataTypes.STRING(12),
            allowNull: true
        },

        Wkn: {
            type: DataTypes.STRING(6),
            allowNull: true
        },

        LastStrikeTime: {
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
            { fields: ['Strikes'] },
            { fields: ['Capitalization'] },
            { fields: ['InstrumentId'] },
            { fields: ['Source'] },
            { fields: ['Isin'] },
            { fields: ['Wkn'] },
            { fields: ['LastStrikeTime'] }
        ]
    });
    instrument.associate = function (models) {
        instrument.hasMany(models.snapshot, { foreignKey: 'Instrument_ID', onDelete: 'CASCADE', hooks: true });
    };
    return instrument;
};