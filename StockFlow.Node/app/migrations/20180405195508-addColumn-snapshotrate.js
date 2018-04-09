'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshotrates', 'createdAt', {
            type: Sequelize.DATE,
            allowNull: false
        }).then(() => {
            queryInterface.addColumn('snapshotrates', 'updatedAt', {
                type: Sequelize.DATE,
                allowNull: false
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshotrates', 'createdAt')
            .then(() => {
                queryInterface.removeColumn('snapshotrates', 'updatedAt');
            });
    }
};