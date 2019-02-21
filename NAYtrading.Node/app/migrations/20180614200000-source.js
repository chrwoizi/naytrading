'use strict';

var fs = require('fs');

var insert_sql = "";
try {
    insert_sql = fs.readFileSync(__dirname + '/sql/insert_sources.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('sources', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            SourceType: {
                allowNull: false,
                type: Sequelize.STRING(10)
            },    
            SourceId: {
                allowNull: false,
                type: Sequelize.STRING(100)
            },   
            MarketId: {
                allowNull: true,
                type: Sequelize.STRING(100)
            },    
            Strikes: {
                allowNull: false,
                type: Sequelize.INTEGER
            },    
            LastStrikeTime: {
                allowNull: false,
                type: Sequelize.DATE
            },    
            Status: {
                allowNull: false,
                type: Sequelize.STRING(10)
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
            return queryInterface.addIndex('sources', ['SourceType']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'Status']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'MarketId']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['MarketId']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'Status']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'SourceId']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'SourceId', 'Status']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'SourceType']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'SourceType', 'Status']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'SourceType', 'SourceId']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'SourceType', 'SourceId', 'Status']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Strikes']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Strikes', 'LastStrikeTime']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['Instrument_ID', 'Strikes', 'LastStrikeTime']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'Strikes']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'Strikes', 'LastStrikeTime']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'SourceId', 'Strikes']);
        }).then(() => {
            return queryInterface.addIndex('sources', ['SourceType', 'SourceId', 'Strikes', 'LastStrikeTime']);
        }).then(() => {
            return queryInterface.sequelize.query(insert_sql);
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'Source');
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'InstrumentId');
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'MarketId');
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'Strikes');
        }).then(() => {
            return queryInterface.removeColumn('instruments', 'LastStrikeTime');
        });
    },
    down: (queryInterface, Sequelize) => {
        throw new Error("not implemented");
    }
};