'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('usersnapshots', 'Decision', {
            type: Sequelize.STRING(8),
            allowNull: true
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('usersnapshots', 'Decision', {
            type: Sequelize.STRING(8),
            allowNull: true
        });
    }
};