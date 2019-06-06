'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshots', 'SourceType', {
            type: Sequelize.STRING(10),
            allowNull: true
        }).then(() => {
            return queryInterface.addColumn('snapshots', 'MarketId', {
                type: Sequelize.STRING(100),
                allowNull: true
            });
        }).then(() => {
            return queryInterface.addIndex('snapshots', ['SourceType']);
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshots', 'SourceType').then(() => {
            return queryInterface.removeColumn('snapshots', 'MarketId');
        });
    }
};