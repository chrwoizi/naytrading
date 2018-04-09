'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('instruments', 'Source', {
            type: Sequelize.STRING,
            allowNull: true
        }).then(() => {
            queryInterface.changeColumn('instruments', 'InstrumentName', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'InstrumentId', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'MarketId', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'User', {
                type: Sequelize.STRING,
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'Isin', {
                type: Sequelize.STRING(12),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'Wkn', {
                type: Sequelize.STRING(6),
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('instruments', 'Source', {
            type: Sequelize.TEXT('long'),
            allowNull: true
        }).then(() => {
            queryInterface.changeColumn('instruments', 'InstrumentName', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'InstrumentId', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'MarketId', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'User', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'Isin', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('instruments', 'Wkn', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        });
    }
};