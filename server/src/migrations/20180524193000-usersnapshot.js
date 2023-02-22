'use strict';

const fs = require('fs');

let insert_sql = "";
try {
    insert_sql = fs.readFileSync(__dirname + '/sql/insert_usersnapshots.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('usersnapshots', {
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
            ModifiedTime: {
                type: Sequelize.DATE,
                allowNull: false
            },
            Decision: {
                type: Sequelize.STRING(6),
                allowNull: true
            },
            Snapshot_ID: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'snapshots', key: 'ID' }
            },
            createdAt: {
                allowNull: true,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: true,
                type: Sequelize.DATE
            }
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['Snapshot_ID']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['Decision']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User', 'Decision']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User', 'Decision', 'Snapshot_ID']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['Decision', 'Snapshot_ID']);
        }).then(() => {
            return queryInterface.addIndex('usersnapshots', ['User', 'Snapshot_ID']);
        }).then(() => {
            return queryInterface.sequelize.query(insert_sql);
        }).then(() => {
            return queryInterface.sequelize.query("DELETE FROM s using snapshots AS s\
            WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID)");
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User'])
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['Decision'])
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Time']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Instrument_ID', 'Decision']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Time', 'Instrument_ID']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Decision']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['Time', 'Decision']);
        }).then(() => {
            return queryInterface.removeIndex('snapshots', ['User', 'Time', 'Decision', 'Instrument_ID']);
        }).then(() => {
            return queryInterface.addIndex('snapshots', ['Time', 'Instrument_ID']);
        }).then(() => {
            return queryInterface.removeColumn('snapshots', 'User');
        }).then(() => {
            return queryInterface.removeColumn('snapshots', 'ModifiedTime');
        }).then(() => {
            return queryInterface.removeColumn('snapshots', 'Decision');
        });
    },
    down: (queryInterface, Sequelize) => {
        throw new Error("not implemented");
    }
};