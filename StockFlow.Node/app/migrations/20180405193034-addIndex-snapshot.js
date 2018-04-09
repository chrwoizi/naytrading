'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User']);
    }
};