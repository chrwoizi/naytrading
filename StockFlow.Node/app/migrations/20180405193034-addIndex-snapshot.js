'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User'])
            .then(() => {
                queryInterface.addIndex('snapshots', ['Time'])
            })
            .then(() => {
                queryInterface.addIndex('snapshots', ['Decision'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User'])
            .then(() => {
                queryInterface.removeIndex('snapshots', ['Time'])
            })
            .then(() => {
                queryInterface.removeIndex('snapshots', ['Decision'])
            });
    }
};