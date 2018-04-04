'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('instruments', {
            ID: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },

            Source: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            InstrumentName: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            InstrumentId: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            MarketId: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            Capitalization: {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            },

            User: {
                type: Sequelize.TEXT('long'),
                allowNull: false
            },

            Strikes: {
                type: Sequelize.INTEGER,
                allowNull: false
            },

            Isin: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            Wkn: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            LastStrikeTime: {
                type: Sequelize.DATE,
                allowNull: false
            }

        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('instruments');
    }
};