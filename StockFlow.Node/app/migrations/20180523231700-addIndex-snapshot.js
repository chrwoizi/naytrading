'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['FirstPriceTime'])
            .then(() => {
                return queryInterface.addIndex('snapshots', ['PriceTime', 'FirstPriceTime']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['PriceTime']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['FirstPriceTime'])
        .then(() => {
            return queryInterface.removeIndex('snapshots', ['PriceTime', 'FirstPriceTime']);
        })
        .then(() => {
            return queryInterface.removeIndex('snapshots', ['PriceTime']);
        });
    }
};