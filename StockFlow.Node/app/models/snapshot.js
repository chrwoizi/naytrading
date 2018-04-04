'use strict';
module.exports = (sequelize, DataTypes) => {
    var instrument = sequelize.define('snapshot', {

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

        Instrument_ID: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: 'instruments',
            referencesKey: 'ID'
        }

    }, {});
    instrument.associate = function (models) {
        // associations can be defined here
    };
    return instrument;
};