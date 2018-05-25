'use strict';

var fs = require('fs');

var insert_sql = "";
try {
    insert_sql = fs.readFileSync(__dirname + '/../sql/insert_userinstruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var update_snapshots_sql = "";
try {
    update_snapshots_sql = fs.readFileSync(__dirname + '/../sql/update_snapshots_to_userinstruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var update_weights_sql = "";
try {
    update_weights_sql = fs.readFileSync(__dirname + '/../sql/update_weights_to_userinstruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('userinstruments', {
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
            createdAt: {
                allowNull: true,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: true,
                type: Sequelize.DATE
            }
        }).then(() => {
            return queryInterface.addIndex('userinstruments', ['User']);
        }).then(() => {
            return queryInterface.addIndex('userinstruments', ['Instrument_ID']);
        }).then(() => {
            return queryInterface.addIndex('userinstruments', ['User', 'Instrument_ID']);
        }).then(() => {
            return queryInterface.sequelize.query(insert_sql);
        }).then(() => {
            return queryInterface.sequelize.query(update_snapshots_sql);
        }).then(() => {
            return queryInterface.sequelize.query(update_weights_sql);
        }).then(() => {
            return queryInterface.sequelize.query("DELETE FROM i using instruments AS i\
            WHERE NOT EXISTS (SELECT 1 FROM userinstruments AS u WHERE u.Instrument_ID = i.ID)\
            AND NOT EXISTS (SELECT 1 FROM snapshots AS s WHERE s.Instrument_ID = i.ID)");
        }).then(() => {
            return queryInterface.removeIndex('instruments', ['User', 'Source', 'InstrumentId'])
        }).then(() => {
            return queryInterface.removeIndex('instruments', ['User', 'Strikes']);
        }).then(() => {
            return queryInterface.addIndex('instruments', ['Source', 'InstrumentId']);
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'User');
        });
    },
    down: (queryInterface, Sequelize) => {
        throw "not implemented";
    }
};