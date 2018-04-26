'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshots', 'Decision', {
            type: Sequelize.STRING(6),
            allowNull: true
        }).then(() => {
            return queryInterface.changeColumn('snapshots', 'User', {
                type: Sequelize.STRING,
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshots', 'Decision', {
            type: Sequelize.TEXT('long'),
            allowNull: true
        }).then(() => {
            return queryInterface.changeColumn('snapshots', 'User', {
                type: Sequelize.TEXT('long'),
                allowNull: true
            });
        });
    }
};