'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('instruments', 'createdAt', {
            type: Sequelize.DATE,
            allowNull: true
        }).then(() => {
            queryInterface.addColumn('instruments', 'updatedAt', {
                type: Sequelize.DATE,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('instruments', 'createdAt')
            .then(() => {
                queryInterface.removeColumn('instruments', 'updatedAt');
            });
    }
};