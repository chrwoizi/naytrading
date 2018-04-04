'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('snapshotrates', {
            ID: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },

            Time: {
                type: Sequelize.DATE,
                allowNull: false
            },

            Open: {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            },

            Close: {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            },

            High: {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            },

            Low: {
                type: Sequelize.DECIMAL(18, 2),
                allowNull: true
            },

            Snapshot_ID: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'snapshots', key: 'ID' }
            }

        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('snapshots');
    }
};