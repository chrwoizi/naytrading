'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addIndex('snapshots', ['User'])
            .then(() => {
                return queryInterface.addIndex('snapshots', ['Time'])
            })
            .then(() => {
                return queryInterface.addIndex('snapshots', ['Decision'])
            });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeIndex('snapshots', ['User'])
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['Time'])
            })
            .then(() => {
                return queryInterface.removeIndex('snapshots', ['Decision'])
            });
    }
};