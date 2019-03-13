'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshotrates', ['Time']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshotrates', ['Time']);
    }
};