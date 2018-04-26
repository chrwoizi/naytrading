'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User', 'Time', 'Decision', 'Instrument_ID']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User', 'Time', 'Decision', 'Instrument_ID']);
    }
};