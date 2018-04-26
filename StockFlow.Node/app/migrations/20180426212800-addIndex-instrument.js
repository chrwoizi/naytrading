'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['User', 'Source', 'InstrumentId'])
            .then(() => {
                queryInterface.addIndex('instruments', ['User', 'Strikes']);
            })
            .then(() => {
                queryInterface.addIndex('instruments', ['Strikes', 'LastStrikeTime']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['User', 'Source', 'InstrumentId'])
            .then(() => {
                queryInterface.removeIndex('instruments', ['User', 'Strikes']);
            })
            .then(() => {
                queryInterface.removeIndex('instruments', ['Strikes', 'LastStrikeTime']);
            });
    }
};