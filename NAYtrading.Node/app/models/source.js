'use strict';
module.exports = (sequelize, DataTypes) => {
    var source = sequelize.define('source', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        SourceType: {
            allowNull: false,
            type: DataTypes.STRING(10)
        },

        SourceId: {
            allowNull: false,
            type: DataTypes.STRING(100)
        },

        MarketId: {
            allowNull: true,
            type: DataTypes.STRING(100)
        }, 

        Strikes: {
            allowNull: false,
            type: DataTypes.INTEGER
        },    

        LastStrikeTime: {
            allowNull: false,
            type: DataTypes.DATE
        },   

        Status: {
            allowNull: false,
            type: DataTypes.STRING(10)
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
            { fields: ['SourceType'] },
            { fields: ['SourceType', 'Status'] },
            { fields: ['SourceType', 'MarketId'] },
            { fields: ['MarketId'] },
            { fields: ['Instrument_ID'] },
            { fields: ['Instrument_ID', 'Status'] },
            { fields: ['SourceType', 'SourceId'] },
            { fields: ['SourceType', 'SourceId', 'Status'] },
            { fields: ['Instrument_ID', 'SourceType'] },
            { fields: ['Instrument_ID', 'SourceType', 'Status'] },
            { fields: ['Instrument_ID', 'SourceType', 'SourceId'] },
            { fields: ['Instrument_ID', 'SourceType', 'SourceId', 'Status'] },
            { fields: ['Strikes'] },
            { fields: ['Strikes', 'LastStrikeTime'] },
            { fields: ['Instrument_ID', 'Strikes', 'LastStrikeTime'] },
            { fields: ['SourceType', 'Strikes'] },
            { fields: ['SourceType', 'Strikes', 'LastStrikeTime'] },
            { fields: ['SourceType', 'SourceId', 'Strikes'] },
            { fields: ['SourceType', 'SourceId', 'Strikes', 'LastStrikeTime'] }
        ]
    });
    source.associate = function (models) {
        source.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
    };
    return source;
};