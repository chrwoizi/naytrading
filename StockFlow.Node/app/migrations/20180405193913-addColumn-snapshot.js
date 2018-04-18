'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshots', 'createdAt', {
            type: Sequelize.DATE,
            allowNull: true
        }).then(() => {
            queryInterface.addColumn('snapshots', 'updatedAt', {
                type: Sequelize.DATE,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshots', 'createdAt')
            .then(() => {
                queryInterface.removeColumn('snapshots', 'updatedAt');
            });
    }
};