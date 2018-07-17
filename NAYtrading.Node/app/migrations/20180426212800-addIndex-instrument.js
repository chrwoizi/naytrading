'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('instruments', ['User', 'Source', 'InstrumentId'])
            .then(() => {
                return queryInterface.addIndex('instruments', ['User', 'Strikes']);
            })
            .then(() => {
                return queryInterface.addIndex('instruments', ['Strikes', 'LastStrikeTime']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('instruments', ['User', 'Source', 'InstrumentId'])
            .then(() => {
                return queryInterface.removeIndex('instruments', ['User', 'Strikes']);
            })
            .then(() => {
                return queryInterface.removeIndex('instruments', ['Strikes', 'LastStrikeTime']);
            });
    }
};