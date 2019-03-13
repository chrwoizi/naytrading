'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshots', 'FirstPriceTime', {
            type: Sequelize.DATE,
            allowNull: true
        }).then(() => {
            return queryInterface.sequelize.query('UPDATE snapshots AS s SET s.FirstPriceTime = (SELECT MIN(r.Time) FROM snapshotrates AS r WHERE r.Snapshot_ID = s.ID)');
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshots', 'FirstPriceTime');
    }
};