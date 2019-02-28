'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('tradelogs', ['Snapshot_ID', 'User'])
            .then(() => {
                return queryInterface.addIndex('tradelogs', ['Time', 'User']);
            })
            .then(() => {
                return queryInterface.addIndex('tradelogs', ['Snapshot_ID', 'User', 'Time']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('tradelogs', ['Snapshot_ID', 'User'])
        .then(() => {
            return queryInterface.removeIndex('tradelogs', ['Time', 'User']);
        })
        .then(() => {
            return queryInterface.removeIndex('tradelogs', ['Snapshot_ID', 'User', 'Time']);
        });
    }
};