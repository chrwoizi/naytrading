'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshots', 'Split', {
            type: Sequelize.STRING(30),
            allowNull: true
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshots', 'Split', {
            type: Sequelize.STRING(10),
            allowNull: true
        });
    }
};