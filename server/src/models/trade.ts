import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class Trade extends Model<
  InferAttributes<Trade>,
  InferCreationAttributes<Trade>
> {
  declare ID: number;
  declare Time: Date;
  declare User: string;
  declare Price: number;
  declare Quantity: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Snapshot_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    Trade.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        Time: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        User: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        Price: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: false,
        },

        Quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        createdAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },

        updatedAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
      },
      {
        tableName: 'trades',
        indexes: [
          { fields: ['User'] },
          { fields: ['Time'] },
          { fields: ['User', 'Snapshot_ID'] },
          { fields: ['User', 'Time'] },
          { fields: ['User', 'Time', 'Snapshot_ID'] },
          { fields: ['Time', 'Snapshot_ID'] },
        ],
        sequelize,
      }
    );

    return Trade;
  }

  static initAssociations(models) {
    Trade.belongsTo(models.snapshot, {
      foreignKey: 'Snapshot_ID',
    });
  }
}
