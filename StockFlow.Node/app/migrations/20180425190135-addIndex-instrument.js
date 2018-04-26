'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['InstrumentId'])
            .then(() => {
                return queryInterface.addIndex('instruments', ['Source'])
            })
            .then(() => {
                return queryInterface.addIndex('instruments', ['Isin'])
            })
            .then(() => {
                return queryInterface.addIndex('instruments', ['Wkn'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['InstrumentId'])
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Source'])
            })
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Isin'])
            })
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Wkn'])
            });
    }
};