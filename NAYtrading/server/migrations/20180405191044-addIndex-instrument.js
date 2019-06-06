'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['User'])
            .then(() => {
                return queryInterface.addIndex('instruments', ['Strikes'])
            })
            .then(() => {
                return queryInterface.addIndex('instruments', ['Capitalization'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['User'])
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Strikes'])
            })
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Capitalization'])
            });
    }
};