import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class TradeLog extends Model<
  InferAttributes<TradeLog>,
  InferCreationAttributes<TradeLog>
> {
  declare ID: number;
  declare Snapshot_ID: ForeignKey<number>;
  declare User: string;
  declare Time: Date;
  declare Quantity: number;
  declare Price: number;
  declare Status: string;
  declare Message: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    TradeLog.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        Snapshot_ID: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        User: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        Time: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        Quantity: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },

        Price: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        Status: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        Message: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        tableName: 'tradelogs',
        indexes: [
          { fields: ['Snapshot_ID'] },
          { fields: ['Time'] },
          { fields: ['Snapshot_ID', 'Time'] },
        ],
        sequelize,
      }
    );

    return TradeLog;
  }

  static initAssociations(models) {
    TradeLog.belongsTo(models.snapshot, {
      foreignKey: 'Snapshot_ID',
    });
  }
}
