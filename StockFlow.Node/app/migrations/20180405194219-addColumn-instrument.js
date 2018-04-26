'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('instruments', 'createdAt', {
            type: Sequelize.DATE,
            allowNull: true
        }).then(() => {
            return queryInterface.addColumn('instruments', 'updatedAt', {
                type: Sequelize.DATE,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('instruments', 'createdAt')
            .then(() => {
                return queryInterface.removeColumn('instruments', 'updatedAt');
            });
    }
};