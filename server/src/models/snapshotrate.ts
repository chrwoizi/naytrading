import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class SnapshotRate extends Model<
  InferAttributes<SnapshotRate>,
  InferCreationAttributes<SnapshotRate>
> {
  declare ID: number;
  declare Time: Date;
  declare Open: number;
  declare Close: number;
  declare High: number;
  declare Low: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Snapshot_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    SnapshotRate.init(
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

        Open: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        Close: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        High: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        Low: {
          type: DataTypes.DECIMAL(8, 2),
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
        tableName: 'snapshotrates',
        indexes: [
          { fields: ['Time'] },
          { fields: ['Snapshot_ID', 'Time'] },
          { fields: ['Snapshot_ID'] },
        ],
        sequelize,
      }
    );

    return SnapshotRate;
  }

  static initAssociations(models) {
    SnapshotRate.belongsTo(models.snapshot, {
      foreignKey: 'Snapshot_ID',
    });
  }
}
