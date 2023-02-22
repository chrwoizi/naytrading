import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';
import { Instrument } from './instrument';
import { SnapshotRate } from './snapshotrate';

export class Snapshot extends Model<
  InferAttributes<Snapshot>,
  InferCreationAttributes<Snapshot>
> {
  declare ID: number;
  declare StartTime: Date;
  declare Time: Date;
  declare Price: number;
  declare PriceTime: Date;
  declare FirstPriceTime: Date;
  declare Split: string;
  declare SourceType: string;
  declare MarketId: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Instrument_ID: ForeignKey<number>;
  declare Snapshot_ID: ForeignKey<number>;
  declare snapshotrates?: SnapshotRate[];
  declare instrument?: Instrument;

  static initSchema(sequelize: Sequelize) {
    Snapshot.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        StartTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        Time: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        Price: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: false,
        },

        PriceTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        FirstPriceTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        Split: {
          allowNull: true,
          type: DataTypes.STRING(30),
        },

        SourceType: {
          allowNull: false,
          type: DataTypes.STRING(10),
        },

        MarketId: {
          allowNull: true,
          type: DataTypes.STRING(100),
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
        tableName: 'snapshots',
        indexes: [
          { fields: ['Time'] },
          { fields: ['Instrument_ID'] },
          { fields: ['Time', 'Instrument_ID'] },
          { fields: ['PriceTime'] },
          { fields: ['PriceTime', 'FirstPriceTime'] },
          { fields: ['FirstPriceTime'] },
          { fields: ['SourceType'] },
          { fields: ['Split'] },
        ],
        sequelize,
      }
    );

    return Snapshot;
  }

  static initAssociations(models) {
    Snapshot.belongsTo(models.instrument, {
      foreignKey: 'Instrument_ID',
    });
    Snapshot.hasMany(models.snapshotrate, {
      foreignKey: 'Snapshot_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
    Snapshot.hasMany(models.usersnapshot, {
      foreignKey: 'Snapshot_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
    Snapshot.hasMany(models.tradelog, {
      foreignKey: 'Snapshot_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
  }
}
