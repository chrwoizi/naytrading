'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('portfolios', 'Deposit', {
            type: Sequelize.DECIMAL(14, 2),
            allowNull: false
        }).then(() => {
            queryInterface.changeColumn('portfolios', 'Balance', {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false
            })
        }).then(() => {
            queryInterface.changeColumn('portfolios', 'Value', {
                type: Sequelize.DECIMAL(14, 2),
                allowNull: false
            })
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('portfolios', 'Decision', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
        }).then(() => {
            queryInterface.changeColumn('portfolios', 'Balance', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            })
        }).then(() => {
            queryInterface.changeColumn('portfolios', 'Value', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            })
        });
    }
};