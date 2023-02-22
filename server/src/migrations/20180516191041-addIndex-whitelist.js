'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('whitelists', ['email']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('whitelists', ['email']);
    }
};