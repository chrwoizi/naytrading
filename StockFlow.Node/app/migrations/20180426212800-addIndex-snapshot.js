'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User', 'Time'])
            .then(() => {
                queryInterface.addIndex('snapshots', ['User', 'Instrument_ID']);
            })
            .then(() => {
                queryInterface.addIndex('snapshots', ['User', 'Instrument_ID', 'Decision']);
            })
            .then(() => {
                queryInterface.addIndex('snapshots', ['User', 'Time', 'Instrument_ID']);
            })
            .then(() => {
                queryInterface.addIndex('snapshots', ['User', 'Decision']);
            })
            .then(() => {
                queryInterface.addIndex('snapshots', ['Time', 'Decision']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User', 'Time'])
            .then(() => {
                queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID']);
            })
            .then(() => {
                queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID', 'Decision']);
            })
            .then(() => {
                queryInterface.removeIndex('snapshots', ['User', 'Time', 'Instrument_ID']);
            })
            .then(() => {
                queryInterface.removeIndex('snapshots', ['User', 'Decision']);
            })
            .then(() => {
                queryInterface.removeIndex('snapshots', ['Time', 'Decision']);
            });
    }
};