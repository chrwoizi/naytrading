'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['LastStrikeTime']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['LastStrikeTime']);
    }
};