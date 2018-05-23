'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['LastPriceTime'])
            .then(() => {
                return queryInterface.addIndex('snapshots', ['PriceTime', 'LastPriceTime']);
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['PriceTime']);
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['LastPriceTime'])
        .then(() => {
            return queryInterface.removeIndex('snapshots', ['PriceTime', 'LastPriceTime']);
        })
        .then(() => {
            return queryInterface.removeIndex('snapshots', ['PriceTime']);
        });
    }
};