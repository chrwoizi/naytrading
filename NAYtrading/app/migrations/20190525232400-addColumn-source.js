'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('sources', 'StrikeReason', {
            type: Sequelize.STRING(200),
            allowNull: true
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('sources', 'StrikeReason');
    }
};