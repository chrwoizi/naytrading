'use strict';
module.exports = (sequelize, DataTypes) => {
    var instrument = sequelize.define('instrument', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        InstrumentName: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Capitalization: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        Isin: {
            type: DataTypes.STRING(12),
            allowNull: true
        },

        Wkn: {
            type: DataTypes.STRING(6),
            allowNull: true
        },

        FirstRateDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        LastRateDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        Split: {
            allowNull: true,
            type: DataTypes.STRING(30)
        },

        SplitUpdatedAt: {
            allowNull: true,
            type: DataTypes.DATE
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
                { fields: ['Capitalization'] },
                { fields: ['Isin'] },
                { fields: ['Wkn'] },
                { fields: ['Split'] },
                { fields: ['SplitUpdatedAt'] }
            ]
        });
    instrument.associate = function (models) {
        instrument.hasMany(models.snapshot, { foreignKey: 'Instrument_ID', onDelete: 'CASCADE', hooks: true });
        instrument.hasMany(models.userinstrument, { foreignKey: 'Instrument_ID', onDelete: 'CASCADE', hooks: true });
        instrument.hasMany(models.source, { foreignKey: 'Instrument_ID', onDelete: 'CASCADE', hooks: true });
        instrument.hasMany(models.instrumentrate, { foreignKey: 'Instrument_ID', onDelete: 'CASCADE', hooks: true });
    };
    return instrument;
};