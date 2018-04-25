'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['InstrumentId'])
            .then(() => {
                queryInterface.addIndex('instruments', ['Source'])
            })
            .then(() => {
                queryInterface.addIndex('instruments', ['Isin'])
            })
            .then(() => {
                queryInterface.addIndex('instruments', ['Wkn'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['InstrumentId'])
            .then(() => {
                queryInterface.removeIndex('instruments', ['Source'])
            })
            .then(() => {
                queryInterface.removeIndex('instruments', ['Isin'])
            })
            .then(() => {
                queryInterface.removeIndex('instruments', ['Wkn'])
            });
    }
};