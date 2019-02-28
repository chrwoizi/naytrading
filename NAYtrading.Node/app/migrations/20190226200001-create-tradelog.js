'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('tradelogs', {
            ID: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },

            Snapshot_ID: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'snapshots', key: 'ID' }
            },
    
            User: {
                type: Sequelize.STRING,
                allowNull: false
            },
    
            Time: {
                type: Sequelize.DATE,
                allowNull: false
            },
    
            Quantity: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
    
            Price: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            },
    
            Status: {
                type: Sequelize.STRING,
                allowNull: true
            },
    
            Message: {
                type: Sequelize.TEXT,
                allowNull: true
            },
    
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
    
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('tradelogs');
    }
};