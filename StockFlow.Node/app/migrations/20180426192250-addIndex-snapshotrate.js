'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshotrates', ['Snapshot_ID', 'Time']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshotrates', ['Snapshot_ID', 'Time']);
    }
};