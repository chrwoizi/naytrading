'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('instrumentrates', {
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
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            },

            Close: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            },

            High: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            },

            Low: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: true
            },

            Instrument_ID: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'instruments', key: 'ID' }
            },

            createdAt: {
                type: Sequelize.DATE,
                allowNull: true
            },

            updatedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }

        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('instrumentrates');
    }
};