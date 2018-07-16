'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('weights', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            User: {
                type: Sequelize.STRING,
                allowNull: true
            },
            Instrument_ID: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'instruments', key: 'ID' }
            },
            Type: {
                type: Sequelize.STRING(32),
                allowNull: true
            },
            Weight: {
                type: Sequelize.DECIMAL(12, 6),
                allowNull: false
            },
            createdAt: {
                allowNull: true,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: true,
                type: Sequelize.DATE
            }
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('weights');
    }
};