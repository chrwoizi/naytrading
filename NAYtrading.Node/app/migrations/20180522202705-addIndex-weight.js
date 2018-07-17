'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('weights', ['User'])
            .then(() => {
                return queryInterface.addIndex('weights', ['Instrument_ID']);
            })
            .then(() => {
                return queryInterface.addIndex('weights', ['Type']);
            })
            .then(() => {
                return queryInterface.addIndex('weights', ['User', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.addIndex('weights', ['User', 'Type']);
            })
            .then(() => {
                return queryInterface.addIndex('weights', ['Instrument_ID', 'Type']);
            })
            .then(() => {
                return queryInterface.addIndex('weights', ['User', 'Instrument_ID', 'Type']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('weights', ['User'])
            .then(() => {
                return queryInterface.removeIndex('weights', ['Instrument_ID']);
            })
            .then(() => {
                return queryInterface.removeIndex('weights', ['Type']);
            })
            .then(() => {
                return queryInterface.removeIndex('weights', ['User', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.removeIndex('weights', ['User', 'Type']);
            })
            .then(() => {
                return queryInterface.removeIndex('weights', ['Instrument_ID', 'Type']);
            })
            .then(() => {
                return queryInterface.removeIndex('weights', ['User', 'Instrument_ID', 'Type']);
            });
    }
};