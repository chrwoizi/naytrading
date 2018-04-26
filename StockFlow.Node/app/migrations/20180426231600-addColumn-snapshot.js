'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn('snapshots', 'Price', {
            type: Sequelize.DECIMAL(8,2),
            allowNull: true
        }).then(() => {
            return queryInterface.addColumn('snapshots', 'PriceTime', {
                type: Sequelize.DATE,
                allowNull: true
            });
        }).then(() => {
            return queryInterface.sequelize.query('UPDATE snapshots AS s SET s.Price = (SELECT r.Close FROM snapshotrates AS r WHERE r.Snapshot_ID = s.ID ORDER BY r.Time DESC LIMIT 1)');
        }).then(() => {
            return queryInterface.sequelize.query('UPDATE snapshots AS s SET s.PriceTime = (SELECT MAX(r.Time) FROM snapshotrates AS r WHERE r.Snapshot_ID = s.ID)');
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('snapshots', 'Price')
            .then(() => {
                return queryInterface.removeColumn('snapshots', 'PriceTime');
            });
    }
};