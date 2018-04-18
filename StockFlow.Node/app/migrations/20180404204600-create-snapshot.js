'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('snapshots', {
            ID: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },

            StartTime: {
                type: Sequelize.DATE,
                allowNull: false
            },

            Time: {
                type: Sequelize.DATE,
                allowNull: false
            },

            ModifiedTime: {
                type: Sequelize.DATE,
                allowNull: false
            },

            Decision: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            User: {
                type: Sequelize.TEXT('long'),
                allowNull: true
            },

            Instrument_ID: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'instruments', key: 'ID' }
            }

        }).then(function () {
            queryInterface.sequelize.query("ALTER TABLE snapshots DROP FOREIGN KEY snapshots_ibfk_1");
            queryInterface.sequelize.query("ALTER TABLE snapshots ADD CONSTRAINT snapshots_ibfk_1 FOREIGN KEY (Instrument_ID) REFERENCES instruments (ID) ON DELETE CASCADE;");
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('snapshots');
    }
};