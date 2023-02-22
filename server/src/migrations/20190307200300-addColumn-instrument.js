'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('instruments', 'FirstRateDate', {
            type: Sequelize.DATE,
            allowNull: true
        }).then(() => {
            return queryInterface.addColumn('instruments', 'LastRateDate', {
                type: Sequelize.DATE,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('instruments', 'FirstRateDate')
            .then(() => {
                return queryInterface.removeColumn('instruments', 'LastRateDate');
            });
    }
};