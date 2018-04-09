'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(6, 2),
            allowNull: true
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Close', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: true
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(18, 2),
            allowNull: true
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Close', {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            });
        });
    }
};