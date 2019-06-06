'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['ID', 'Capitalization', 'Strikes']);
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['ID', 'Capitalization', 'Strikes']);
    }
};