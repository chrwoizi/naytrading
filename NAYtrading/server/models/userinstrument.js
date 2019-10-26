'use strict';
module.exports = (sequelize, DataTypes) => {
    const userinstrument = sequelize.define('userinstrument', {

        ID: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },

        User: {
            allowNull: false,
            type: DataTypes.STRING
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
                { fields: ['User', 'Instrument_ID'] },
                { fields: ['Instrument_ID'] }
            ]
        });
    userinstrument.associate = function (models) {
        userinstrument.belongsTo(models.instrument, { foreignKey: 'Instrument_ID', allowNull: false });
    };
    return userinstrument;
};