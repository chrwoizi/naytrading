'use strict';
module.exports = {
    up: (queryInterface, Sequelize, onDone) => {
        return queryInterface.createTable('trades', {

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

            Price: {
                type: Sequelize.DECIMAL(8, 2),
                allowNull: false
            },

            Quantity: {
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
            },

            Snapshot_ID: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: 'snapshots', key: 'ID' }
            }

        }).then(() => {
            queryInterface.addIndex('trades', ['Time'])
        }).then(() => {
            queryInterface.addIndex('trades', ['User'])
        }).then(() => {
            queryInterface.sequelize.query("SELECT CONSTRAINT_NAME AS name FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = 'trades' AND CONSTRAINT_TYPE='FOREIGN KEY'")
            .then(names => {
                var name = "trades_ibfk_1";

                function create() {
                    console.log("Create " + name);
                    return queryInterface.sequelize.query("ALTER TABLE trades ADD CONSTRAINT " + name + " FOREIGN KEY (Snapshot_ID) REFERENCES snapshots (ID) ON DELETE CASCADE")
                        .then(x => onDone());
                }

                if (names && names.length > 0 && names[0].length > 0 && names[0][0].name) {
                    name = names[0][0].name;
                    console.log("Drop " + names[0][0].name);
                    return queryInterface.sequelize.query("ALTER TABLE trades DROP FOREIGN KEY " + name)
                        .then(create);
                }
                else {
                    return create();
                }
            });
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.dropTable('trades');
    }
};