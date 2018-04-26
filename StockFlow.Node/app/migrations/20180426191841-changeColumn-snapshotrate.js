'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: false
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Close', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.changeColumn('snapshotrates', 'Open', {
            type: Sequelize.DECIMAL(6, 2),
            allowNull: false
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Close', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: false
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'High', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: false
            });
        }).then(() => {
            queryInterface.changeColumn('snapshotrates', 'Low', {
                type: Sequelize.DECIMAL(6, 2),
                allowNull: false
            });
        });
    }
};