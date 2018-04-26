'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('portfolios', {

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

            User: {
                type: Sequelize.STRING,
                allowNull: false
            },

            Deposit: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            },

            Balance: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            },

            Value: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            },

            OpenCount: {
                type: Sequelize.INTEGER,
                allowNull: false
            },

            CompleteCount: {
                type: Sequelize.INTEGER,
                allowNull: false
            },

            createdAt: {
                type: Sequelize.DATE,
                allowNull: true
            },

            updatedAt: {
                type: Sequelize.DATE,
                allowNull: true
            }

        }).then(() => {
            queryInterface.addIndex('portfolios', ['Time'])
        }).then(() => {
            queryInterface.addIndex('portfolios', ['User'])
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('portfolios');
    }
};