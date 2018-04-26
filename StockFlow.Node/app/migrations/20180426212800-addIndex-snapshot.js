'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User', 'Time'])
            .then(() => {
                return queryInterface.addIndex('snapshots', ['User', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['User', 'Instrument_ID', 'Decision']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['User', 'Time', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['User', 'Decision']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['Time', 'Decision']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User', 'Time'])
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID', 'Decision']);
            })
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['User', 'Time', 'Instrument_ID']);
            })
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['User', 'Decision']);
            })
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['Time', 'Decision']);
            });
    }
};