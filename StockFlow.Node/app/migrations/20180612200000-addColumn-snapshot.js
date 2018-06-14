'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshots', 'Split', {
            type: Sequelize.STRING(10),
            allowNull: true
        }).then(() => {
            return queryInterface.addIndex('snapshots', ['Split']);
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshots', 'Split');
    }
};