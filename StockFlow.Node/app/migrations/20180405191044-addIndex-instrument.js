'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['User']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['User']);
    }
};