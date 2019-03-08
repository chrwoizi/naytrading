'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instrumentrates', ['Time'])
            .then(() => {
                queryInterface.addIndex('instrumentrates', ['Instrument_ID', 'Time']);
            })
            .then(() => {
                queryInterface.addIndex('instrumentrates', ['Instrument_ID']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instrumentrates', ['Time'])
            .then(() => {
                queryInterface.removeIndex('instrumentrates', ['Instrument_ID', 'Time']);
            })
            .then(() => {
                queryInterface.removeIndex('instrumentrates', ['Instrument_ID']);
            });
    }
};