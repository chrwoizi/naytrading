'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('instruments', 'Split', {
            type: Sequelize.STRING(30),
            allowNull: true
        }).then(() => {
            return queryInterface.addColumn('instruments', 'SplitUpdatedAt', {
                type: Sequelize.DATE,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('instruments', 'Split')
            .then(() => {
                return queryInterface.removeColumn('instruments', 'SplitUpdatedAt');
            });
    }
};