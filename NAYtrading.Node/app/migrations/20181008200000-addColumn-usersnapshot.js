'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('usersnapshots', 'Confirmed', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User', 'Confirmed']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User', 'Confirmed', 'ModifiedTime']);
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('usersnapshots', 'Confirmed');
    }
};