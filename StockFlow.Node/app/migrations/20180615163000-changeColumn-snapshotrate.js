'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true
        }).then(() => {
            return queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            });
        }).then(() => {
            return queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: false
        }).then(() => {
            return queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            });
        }).then(() => {
            return queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            });
        });
    }
};