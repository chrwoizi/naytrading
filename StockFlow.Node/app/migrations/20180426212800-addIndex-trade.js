'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('trades', ['User', 'Snapshot_ID'])
            .then(() => {
                queryInterface.addIndex('trades', ['User', 'Time']);
            })
            .then(() => {
                queryInterface.addIndex('trades', ['User', 'Time', 'Snapshot_ID']);
            })
            .then(() => {
                queryInterface.addIndex('trades', ['Time', 'Snapshot_ID']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('trades', ['User', 'Snapshot_ID'])
            .then(() => {
                queryInterface.removeIndex('trades', ['User', 'Time']);
            })
            .then(() => {
                queryInterface.removeIndex('trades', ['User', 'Time', 'Snapshot_ID']);
            })
            .then(() => {
                queryInterface.removeIndex('trades', ['Time', 'Snapshot_ID']);
            });
    }
};