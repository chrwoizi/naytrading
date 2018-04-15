'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['User'])
            .then(() => {
                queryInterface.addIndex('instruments', ['Strikes'])
            })
            .then(() => {
                queryInterface.addIndex('instruments', ['Capitalization'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['User'])
            .then(() => {
                queryInterface.removeIndex('instruments', ['Strikes'])
            })
            .then(() => {
                queryInterface.removeIndex('instruments', ['Capitalization'])
            });
    }
};