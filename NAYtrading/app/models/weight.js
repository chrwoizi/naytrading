'use strict';
module.exports = (sequelize, DataTypes) => {
    var weight = sequelize.define('weight', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        
        User: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Type: {
            type: DataTypes.STRING,
            allowNull: true
        },

        Weight: {
            type: DataTypes.DECIMAL(12,6),
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
            { fields: ['Instrument_ID'] },
            { fields: ['Type'] },
            { fields: ['User', 'Instrument_ID'] },
            { fields: ['User', 'Type'] },
            { fields: ['Instrument_ID', 'Type'] },
            { fields: ['User', 'Instrument_ID', 'Type'] }
        ]
    });
    weight.associate = function (models) {
        weight.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
    };
    return weight;
};